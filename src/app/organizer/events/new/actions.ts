"use server";

import { redirect } from "next/navigation";
import { createOrganizerRace, OrganizerError, requireApprovedOrganizer } from "@/lib/organizer";

export type OrganizerRaceActionState = {
  error?: string;
};

export async function createOrganizerRaceAction(
  _previousState: OrganizerRaceActionState,
  formData: FormData
): Promise<OrganizerRaceActionState> {
  const { organization } = await requireApprovedOrganizer();

  try {
    await createOrganizerRace({
      organizationId: organization.id,
      input: {
        title: getString(formData, "title"),
        description: getString(formData, "description"),
        raceType: getString(formData, "raceType"),
        startDate: getString(formData, "startDate"),
        registrationCloseAt: getOptionalString(formData, "registrationCloseAt"),
        wilaya: getString(formData, "wilaya"),
        city: getString(formData, "city"),
        commune: getOptionalString(formData, "commune"),
        address: getOptionalString(formData, "address"),
        contactEmail: getOptionalString(formData, "contactEmail"),
        contactPhone: getOptionalString(formData, "contactPhone"),
        maxParticipants: getOptionalString(formData, "maxParticipants"),
        categoryName: getString(formData, "categoryName"),
        distanceKm: getString(formData, "distanceKm"),
        priceDzd: getOptionalString(formData, "priceDzd"),
        categoryMaxParticipants: getOptionalString(formData, "categoryMaxParticipants")
      }
    });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  redirect("/organizer/events?created=1");
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value || undefined;
}
