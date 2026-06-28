"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getPrisma } from "@/lib/db";
import { isEmailVerified } from "@/lib/email-verification";
import { getDictionary, getLocale } from "@/lib/i18n";
import { loginSchema } from "@/lib/validations";
import type { UserRole } from "@/types/race";

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
