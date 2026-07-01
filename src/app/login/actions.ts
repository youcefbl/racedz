"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getPrisma } from "@/lib/db";
import { createEmailVerificationToken, isEmailVerified, sendAccountVerificationEmail } from "@/lib/email-verification";
import { getDictionary, getLocale } from "@/lib/i18n";
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
  const t = getDictionary(getLocale(formData.get("lang") as string | null)).auth;
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: t.errInvalidInput };
  }

  const user = await getPrisma().user.findUnique({
    where: { email: parsed.data.email },
    select: { role: true }
  });

  if (user && !(await isEmailVerified(parsed.data.email))) {
    return { error: t.errNotActivated };
  }

  const redirectTo = getPostLoginUrl(user?.role as UserRole | undefined, formData.get("callbackUrl"));

  try {
    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
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
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
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
