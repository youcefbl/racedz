"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { createEmailVerificationToken, sendAccountVerificationEmail } from "@/lib/email-verification";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
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
  const locale = getLocale(formData.get("lang") as string | null);
  const t = getDictionary(locale).auth;
  const callbackUrl = getSafeCallbackUrl(formData.get("callbackUrl"));
  const values = {
    firstName: getString(formData, "firstName"),
    lastName: getString(formData, "lastName"),
    email: getString(formData, "email")
  };

  const ip = clientIp(await headers());
  if (ip && !checkRateLimit(`register:${ip}`, 5, 10 * 60_000).ok) {
    return { error: t.errTooManySignups, values };
  }
  const parsed = registerUserSchema.safeParse({
    ...values,
    password: getString(formData, "password"),
    confirmPassword: getString(formData, "confirmPassword")
  });

  if (!parsed.success) {
    return {
      error: t.errCheckFields,
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
      error: t.errEmailExists,
      fieldErrors: {
        email: t.errUseDifferentEmail
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
    token,
    locale
  });

  const emailDeliveryParam = emailResult.ok ? "" : "&emailDelivery=failed";
  const emailParam = `&email=${encodeURIComponent(user.email)}`;

  const loginUrl = callbackUrl
    ? `/login?registered=1${emailDeliveryParam}${emailParam}&callbackUrl=${encodeURIComponent(callbackUrl)}`
    : `/login?registered=1${emailDeliveryParam}${emailParam}`;
  redirect(withLocale(loginUrl, locale));
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
