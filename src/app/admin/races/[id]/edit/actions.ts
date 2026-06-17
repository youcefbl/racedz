"use server";

import { revalidatePath } from "next/cache";
import { AdminError, requireAdmin, updateAdminRace } from "@/lib/admin";

export type AdminRaceEditActionState = {
  error?: string;
  success?: string;
};

export async function updateAdminRaceAction(
  _previousState: AdminRaceEditActionState,
  formData: FormData
): Promise<AdminRaceEditActionState> {
  const session = await requireAdmin();
  const raceId = getString(formData, "raceId");

  try {
    await updateAdminRace({
      actorId: session.user.id,
      raceEventId: raceId,
      input: {
        title: getString(formData, "title"),
        description: getString(formData, "description"),
        raceType: getString(formData, "raceType"),
        status: getString(formData, "status"),
        registrationStatus: getString(formData, "registrationStatus"),
        startDate: getString(formData, "startDate"),
        registrationCloseAt: getOptionalString(formData, "registrationCloseAt"),
        wilaya: getString(formData, "wilaya"),
        city: getString(formData, "city"),
        commune: getOptionalString(formData, "commune"),
        address: getOptionalString(formData, "address"),
        organizerName: getOptionalString(formData, "organizerName"),
        organizerUrl: getOptionalString(formData, "organizerUrl"),
        contactEmail: getOptionalString(formData, "contactEmail"),
        contactPhone: getOptionalString(formData, "contactPhone"),
        maxParticipants: getOptionalString(formData, "maxParticipants"),
        mainImageUrl: getOptionalString(formData, "mainImageUrl")
      }
    });
  } catch (error) {
    if (error instanceof AdminError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/admin/races");
  revalidatePath(`/admin/races/${raceId}/edit`);
  revalidatePath("/admin/audit");
  revalidatePath("/races");

  return { success: "Race updated." };
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value || undefined;
}
