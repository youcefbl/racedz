"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getPrisma } from "@/lib/db";
import { createEmailVerificationToken, sendAccountVerificationEmail } from "@/lib/email-verification";
import { getDictionary, getLocale } from "@/lib/i18n";
import { verifyLoginCredentials, verifyMfaCode, type CredentialUser } from "@/lib/auth-credentials";
import { createMfaTicket, readMfaTicket } from "@/lib/mfa-ticket";
import { createNativeAuthToken } from "@/lib/native-auth";
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
};

export async function loginAction(_previousState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const lang = formData.get("lang") as string | null;
  const t = getDictionary(getLocale(lang)).auth;
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

  const callbackUrl = getSafeCallbackUrl(formData.get("callbackUrl")) ?? undefined;

  // MFA-protected accounts: route EVERY attempt — right or wrong password — to the dedicated
  // second-factor page, so this page never reveals whether the password was correct. The signed
  // ticket carries the password result (`ff`) tamper-proof; /login/mfa decides the final outcome.
  const account = await getPrisma().user.findUnique({
    where: { email: emailKey },
    select: { id: true, mfaEnabled: true }
  });
  if (account?.mfaEnabled) {
    const passwordOk = Boolean(await verifyLoginCredentials(parsed.data.email, parsed.data.password));
    const ticket = createMfaTicket({ uid: account.id, ff: passwordOk, cb: callbackUrl });
    redirect(mfaPageUrl(ticket, lang));
  }

  // Password-only accounts (unchanged): confirm the password, surface the not-activated hint, sign in.
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

  const redirectTo = getPostLoginUrl(user.role as UserRole | undefined, formData.get("callbackUrl"));

  try {
    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: "",
      redirect: false,
      redirectTo
    });

    if (typeof result === "string" && new URL(result, "http://127.0.0.1:3003").searchParams.has("error")) {
      return { error: t.errInvalidCredentials };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: t.errInvalidCredentials };
    }

    throw error;
  }

  redirect(redirectTo);
}

export type MfaChallengeState = { error?: string };

/**
 * Second-factor step for /login/mfa. Reached only via a signed ticket from a first factor (password
 * or Google). On ANY failure — bad/expired ticket, failed first factor, wrong code — it bounces back
 * to /login with a single generic error, never revealing whether the password or the code was wrong.
 * On success it mints a full session through the single-use native-auth bridge (no half-logged-in
 * state). A failed first factor short-circuits before code verification, so a wrong password can't
 * consume a victim's single-use recovery codes.
 */
export async function completeMfaAction(_previous: MfaChallengeState, formData: FormData): Promise<MfaChallengeState> {
  const lang = formData.get("lang") as string | null;
  const ticket = readMfaTicket(String(formData.get("ticket") ?? ""));
  if (!ticket) bounceToLogin(lang);

  // Throttle second-factor guessing per account.
  if (!checkRateLimit(`mfa-verify:${ticket.uid}`, 10, 10 * 60_000).ok) bounceToLogin(lang);

  const dbUser = await getPrisma().user.findUnique({
    where: { id: ticket.uid },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      firstLoginAt: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaBackupCodes: true,
      organizations: { select: { organizationId: true } }
    }
  });

  const code = String(formData.get("code") ?? "").trim();

  if (!dbUser?.mfaEnabled || !dbUser.mfaSecret || !ticket.ff) bounceToLogin(lang);

  const credentialUser: CredentialUser = {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    role: dbUser.role,
    firstLoginAt: dbUser.firstLoginAt ?? null,
    mfaEnabled: dbUser.mfaEnabled,
    mfaSecret: dbUser.mfaSecret,
    mfaBackupCodes: dbUser.mfaBackupCodes,
    organizationIds: dbUser.organizations.map((member) => member.organizationId)
  };

  if (!(await verifyMfaCode(credentialUser, code))) bounceToLogin(lang);

  // Success: record the login and establish the session via the single-use native-auth token bridge.
  const now = new Date();
  await getPrisma().user.update({
    where: { id: dbUser.id },
    data: { lastLoginAt: now, firstLoginAt: dbUser.firstLoginAt ?? now }
  });

  const redirectTo = getPostLoginUrl(dbUser.role as UserRole | undefined, ticket.cb ?? null);
  const bridgeToken = await createNativeAuthToken(dbUser.id);

  try {
    const result = await signIn("native-bridge", { token: bridgeToken, redirect: false });
    if (typeof result === "string" && new URL(result, "http://127.0.0.1:3003").searchParams.has("error")) {
      bounceToLogin(lang);
    }
  } catch (error) {
    if (error instanceof AuthError) bounceToLogin(lang);
    throw error;
  }

  redirect(redirectTo);
}

function mfaPageUrl(ticket: string, lang: string | null): string {
  const params = new URLSearchParams({ t: ticket });
  if (lang) params.set("lang", lang);
  return `/login/mfa?${params.toString()}`;
}

function bounceToLogin(lang: string | null): never {
  const params = new URLSearchParams({ e: "1" });
  if (lang) params.set("lang", lang);
  redirect(`/login?${params.toString()}`);
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
