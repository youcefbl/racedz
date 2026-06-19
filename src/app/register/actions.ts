"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { createEmailVerificationToken, sendAccountVerificationEmail } from "@/lib/email-verification";
import { registerUserSchema } from "@/lib/validations";

type RegisterFormValues = {
  firstName: string;
  lastName: string;
  arabicFullName: string;
  email: string;
  phone: string;
  wilaya: string;
  commune: string;
  dateOfBirth: string;
  nationalId: string;
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
    arabicFullName: getString(formData, "arabicFullName"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    wilaya: getString(formData, "wilaya"),
    commune: getString(formData, "commune"),
    dateOfBirth: getString(formData, "dateOfBirth"),
    nationalId: getString(formData, "nationalId")
  };
  const parsed = registerUserSchema.safeParse({
    ...values,
    arabicFullName: values.arabicFullName || undefined,
    city: undefined,
    commune: values.commune || undefined,
    dateOfBirth: values.dateOfBirth || undefined,
    nationalId: values.nationalId || undefined,
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

  if (parsed.data.nationalId) {
    const existingNationalId = await prisma.user.findUnique({
      where: { nationalId: parsed.data.nationalId },
      select: { id: true }
    });

    if (existingNationalId) {
      return {
        error: "This ID number is already linked to another account.",
        fieldErrors: {
          nationalId: "Use a different ID number or contact support."
        },
        values
      };
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      arabicFullName: parsed.data.arabicFullName,
      phone: parsed.data.phone,
      role: "RUNNER",
      dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : undefined,
      nationalId: parsed.data.nationalId,
      wilaya: parsed.data.wilaya,
      city: undefined,
      commune: parsed.data.commune
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
