"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { getDictionary, getLocale } from "@/lib/i18n";
import { updateProfileSchema } from "@/lib/validations";

export type ProfileActionState = {
  error?: string;
  success?: string;
};

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await auth();
  const t = getDictionary(getLocale(formData.get("lang") as string | null)).profile;

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/profile");
  }

  const parsed = updateProfileSchema.safeParse({
    firstName: getString(formData, "firstName"),
    lastName: getString(formData, "lastName"),
    arabicFullName: getOptionalString(formData, "arabicFullName"),
    phone: getString(formData, "phone"),
    gender: getOptionalString(formData, "gender"),
    dateOfBirth: getOptionalString(formData, "dateOfBirth"),
    nationalId: getOptionalString(formData, "nationalId"),
    avatarUrl: getOptionalString(formData, "avatarUrl"),
    wilaya: getString(formData, "wilaya"),
    city: getString(formData, "city"),
    commune: getOptionalString(formData, "commune")
  });

  if (!parsed.success) {
    return { error: t.validationError };
  }

  try {
    await getPrisma().user.update({
      where: {
        id: session.user.id
      },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        arabicFullName: parsed.data.arabicFullName,
        phone: parsed.data.phone,
        gender: parsed.data.gender,
        dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
        nationalId: parsed.data.nationalId,
        avatarUrl: parsed.data.avatarUrl,
        wilaya: parsed.data.wilaya,
        city: parsed.data.city,
        commune: parsed.data.commune
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: t.idTaken };
    }

    throw error;
  }

  revalidatePath("/account/profile");
  revalidatePath("/account");

  return { success: t.saveSuccess };
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value || undefined;
}
