"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createRaceRegistrationForUser, RegistrationError } from "@/lib/registrations";

export type RaceRegistrationActionState = {
  error?: string;
};

export async function registerForRaceAction(
  _previousState: RaceRegistrationActionState,
  formData: FormData
): Promise<RaceRegistrationActionState> {
  const raceEventId = getString(formData, "raceEventId");
  const raceSlug = getString(formData, "raceSlug");
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/races/${raceSlug}/register`);
  }

  try {
    await createRaceRegistrationForUser({
      userId: session.user.id,
      raceEventId,
      input: {
        firstName: getString(formData, "firstName"),
        lastName: getString(formData, "lastName"),
        email: getString(formData, "email"),
        phone: getString(formData, "phone"),
        dateOfBirth: getString(formData, "dateOfBirth"),
        gender: getString(formData, "gender"),
        wilaya: getString(formData, "wilaya"),
        city: getString(formData, "city"),
        emergencyContactName: getString(formData, "emergencyContactName"),
        emergencyContactPhone: getString(formData, "emergencyContactPhone"),
        clubName: getOptionalString(formData, "clubName"),
        raceCategoryId: getString(formData, "raceCategoryId"),
        tshirtSize: getOptionalString(formData, "tshirtSize"),
        acceptedTerms: formData.get("acceptedTerms")
      }
    });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return { error: error.message };
    }

    throw error;
  }

  redirect(`/account/registrations?registered=${raceSlug}`);
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();

  return value || undefined;
}
