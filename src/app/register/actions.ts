"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { createEmailVerificationToken, sendAccountVerificationEmail } from "@/lib/email-verification";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { registerUserSchema } from "@/lib/validations";

type RegisterFormValues = {
  firstName: string;
  lastName: string;
  email: string;
};

export type RegisterActionState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof RegisterFormValues | "password" | "confirmPassword", string>>;
  values?: RegisterFormValues;
};

export async function registerAction(
  _previousState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const callbackUrl = getSafeCallbackUrl(formData.get("callbackUrl"));
  const values = {
    firstName: getString(formData, "firstName"),
    lastName: getString(formData, "lastName"),
    email: getString(formData, "email")
  };

  const ip = clientIp(await headers());
  if (ip && !checkRateLimit(`register:${ip}`, 5, 10 * 60_000).ok) {
    return { error: "Too many signups from this network. Please try again later.", values };
  }
  const parsed = registerUserSchema.safeParse({
    ...values,
    password: getString(formData, "password"),
    confirmPassword: getString(formData, "confirmPassword")
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields and try again.",
      fieldErrors: getFieldErrors(parsed.error.flatten().fieldErrors),
      values
    };
  }

  const prisma = getPrisma();
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (existingUser) {
    return {
      error: "An account with this email already exists.",
      fieldErrors: {
        email: "Use a different email or sign in."
      },
      values
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: "RUNNER"
    }
  });
  const token = await createEmailVerificationToken(user.id);
  const emailResult = await sendAccountVerificationEmail({
    to: user.email,
    firstName: user.firstName,
    token
  });

  const emailDeliveryParam = emailResult.ok ? "" : "&emailDelivery=failed";

  redirect(callbackUrl ? `/login?registered=1${emailDeliveryParam}&callbackUrl=${encodeURIComponent(callbackUrl)}` : `/login?registered=1${emailDeliveryParam}`);
}

function getSafeCallbackUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getFieldErrors(errors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(errors).flatMap(([field, messages]) => (messages?.[0] ? [[field, messages[0]]] : []))
  ) as RegisterActionState["fieldErrors"];
}
