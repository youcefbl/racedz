"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getPrisma } from "@/lib/db";
import { isEmailVerified } from "@/lib/email-verification";
import { loginSchema } from "@/lib/validations";
import type { UserRole } from "@/types/race";

export type LoginActionState = {
  error?: string;
};

export async function loginAction(_previousState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const user = await getPrisma().user.findUnique({
    where: { email: parsed.data.email },
    select: { role: true }
  });

  if (user && !(await isEmailVerified(parsed.data.email))) {
    return { error: "Check your email and activate your account before logging in." };
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
      return { error: "Invalid email or password." };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
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
