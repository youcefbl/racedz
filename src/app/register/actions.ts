"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { registerUserSchema } from "@/lib/validations";

export type RegisterActionState = {
  error?: string;
};

export async function registerAction(
  _previousState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const parsed = registerUserSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    arabicFullName: formData.get("arabicFullName") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    wilaya: formData.get("wilaya"),
    city: formData.get("city"),
    commune: formData.get("commune") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    nationalId: formData.get("nationalId") || undefined
  });

  if (!parsed.success) {
    return { error: "Check the required account fields and try again." };
  }

  const prisma = getPrisma();
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.user.create({
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
      city: parsed.data.city,
      commune: parsed.data.commune
    }
  });

  redirect("/login");
}
