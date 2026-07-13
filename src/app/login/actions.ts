"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getPrisma } from "@/lib/db";
import { createEmailVerificationToken, sendAccountVerificationEmail } from "@/lib/email-verification";
import { getDictionary, getLocale } from "@/lib/i18n";
import { verifyLoginCredentials } from "@/lib/auth-credentials";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations";
import type { UserRole } from "@/types/race";

/**
 * Resend the account-verification email. Always reports success so we never reveal
 * whether an email exists or is already verified. The UI enforces a 120s cooldown;
 * this server guard is a backstop against abuse.
 */
export async function resendVerificationAction(email: string, lang?: string | null): Promise<{ ok: boolean }> {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized || !normalized.includes("@")) return { ok: false };

  const ip = clientIp(await headers());
  if (ip && !checkRateLimit(`resend-verify:${ip}`, 5, 10 * 60_000).ok) {
    return { ok: true };
  }

  const user = await getPrisma().user.findUnique({
    where: { email: normalized },
    select: { id: true, firstName: true, email: true, emailVerifiedAt: true }
  });

  if (user && !user.emailVerifiedAt) {
    const token = await createEmailVerificationToken(user.id);
    await sendAccountVerificationEmail({ to: user.email, firstName: user.firstName, token, locale: getLocale(lang) });
  }

  return { ok: true };
}

export type LoginActionState = {
  error?: string;
  // True once the password is confirmed but the account needs a second factor: the form then
  // reveals the authenticator-code input and the user resubmits with the code included.
  mfaRequired?: boolean;
};

export async function loginAction(_previousState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const t = getDictionary(getLocale(formData.get("lang") as string | null)).auth;
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: t.errInvalidInput };
  }

  // Brute-force defense: throttle both per-IP (spray across accounts) and per-email
  // (targeted guessing of one account). Either limit tripping returns a generic error.
  const ip = clientIp(await headers());
  const emailKey = parsed.data.email.toLowerCase();
  const overLimit =
    (ip && !checkRateLimit(`login-ip:${ip}`, 10, 10 * 60_000).ok) ||
    !checkRateLimit(`login-email:${emailKey}`, 10, 10 * 60_000).ok;
  if (overLimit) {
    return { error: t.errInvalidCredentials };
  }

  const totp = typeof formData.get("totp") === "string" ? (formData.get("totp") as string).trim() : "";

  // Confirm the password up front (same check `authorize` runs). This lets us decide whether to
  // prompt for a second factor and surface the "not activated" hint without leaking either fact on
  // a wrong password.
  const user = await verifyLoginCredentials(parsed.data.email, parsed.data.password);

  if (!user) {
    const existing = await getPrisma().user.findUnique({
      where: { email: parsed.data.email },
      select: { emailVerifiedAt: true }
    });
    if (existing && !existing.emailVerifiedAt) {
      return { error: t.errNotActivated };
    }
    return { error: t.errInvalidCredentials };
  }

  // Password is correct. If MFA is on and no code was supplied yet, prompt for one.
  if (user.mfaEnabled && !totp) {
    return { mfaRequired: true };
  }

  const redirectTo = getPostLoginUrl(user.role as UserRole | undefined, formData.get("callbackUrl"));

  try {
    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp,
      redirect: false,
      redirectTo
    });

    if (typeof result === "string" && new URL(result, "http://127.0.0.1:3003").searchParams.has("error")) {
      // Password already validated above, so a failure here is a bad/expired second factor.
      return user.mfaEnabled ? { error: t.errInvalidCode, mfaRequired: true } : { error: t.errInvalidCredentials };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return user.mfaEnabled ? { error: t.errInvalidCode, mfaRequired: true } : { error: t.errInvalidCredentials };
    }

    throw error;
  }

  redirect(redirectTo);
}

function getPostLoginUrl(role: UserRole | undefined, callbackUrl: FormDataEntryValue | null) {
  const safeCallbackUrl = getSafeCallbackUrl(callbackUrl);

  if (role === "RUNNER" && safeCallbackUrl === "/account") {
    return "/account/registrations";
  }

  if (safeCallbackUrl && canUseCallbackForRole(role, safeCallbackUrl)) {
    return safeCallbackUrl;
  }

  switch (role) {
    case "SUPERADMIN":
    case "ADMIN":
      return "/admin";
    case "ORGANIZER":
      return "/organizer";
    case "RUNNER":
    default:
      return "/account/registrations";
  }
}

function getSafeCallbackUrl(value: FormDataEntryValue | null) {
  // Must be a same-origin absolute path. Reject protocol-relative ("//host") and
  // backslash variants ("/\host", "/\\host") that browsers normalize into off-site
  // redirects, and any value whose second character starts a new authority.
  if (typeof value !== "string" || !value.startsWith("/") || /^\/[/\\]/.test(value)) {
    return null;
  }

  return value;
}

function canUseCallbackForRole(role: UserRole | undefined, callbackUrl: string) {
  if (callbackUrl.startsWith("/admin")) {
    return role === "ADMIN" || role === "SUPERADMIN";
  }

  if (callbackUrl.startsWith("/organizer")) {
    return role === "ORGANIZER" || role === "ADMIN" || role === "SUPERADMIN";
  }

  return true;
}
