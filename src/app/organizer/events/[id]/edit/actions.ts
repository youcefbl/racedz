"use server";

import { revalidatePath } from "next/cache";
import {
  OrganizerError,
  requireApprovedOrganizer,
  updateOrganizerRace,
  upsertOrganizerRaceCategory
} from "@/lib/organizer";

export type OrganizerEditActionState = {
  error?: string;
  success?: string;
};

export async function updateOrganizerRaceAction(
  _previousState: OrganizerEditActionState,
  formData: FormData
): Promise<OrganizerEditActionState> {
  const { organization, session } = await requireApprovedOrganizer();
  const raceId = getString(formData, "raceId");

  try {
    await updateOrganizerRace({
      organizationId: organization.id,
      raceEventId: raceId,
      editorId: session.user.id,
      input: {
        title: getString(formData, "title"),
        description: getString(formData, "description"),
        elevationGainText: getOptionalString(formData, "elevationGainText"),
        conditions: getOptionalString(formData, "conditions"),
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
        autoCancelUnpaidAfterHours: getAutoCancelUnpaidAfterHours(formData),
        mainImageUrl: getOptionalString(formData, "mainImageUrl")
      }
    });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidateOrganizerRace(raceId);

  return { success: "Race details updated." };
}

export async function upsertOrganizerCategoryAction(
  _previousState: OrganizerEditActionState,
  formData: FormData
): Promise<OrganizerEditActionState> {
  const { organization, session } = await requireApprovedOrganizer();
  const raceId = getString(formData, "raceId");

  try {
    await upsertOrganizerRaceCategory({
      organizationId: organization.id,
      raceEventId: raceId,
      editorId: session.user.id,
      input: {
        categoryId: getOptionalString(formData, "categoryId"),
        name: getString(formData, "name"),
        raceType: getString(formData, "raceType"),
        distanceKm: getString(formData, "distanceKm"),
        priceDzd: getOptionalString(formData, "priceDzd"),
        maxParticipants: getOptionalString(formData, "maxParticipants"),
        startTime: getOptionalString(formData, "startTime")
      }
    });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidateOrganizerRace(raceId);

  return { success: "Category saved." };
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value || undefined;
}

function getAutoCancelUnpaidAfterHours(formData: FormData) {
  return formData.get("autoCancelUnpaidAfterHours") === "48" ? "48" : undefined;
}

function revalidateOrganizerRace(raceId: string) {
  revalidatePath("/organizer/events");
  revalidatePath(`/organizer/events/${raceId}`);
  revalidatePath(`/organizer/events/${raceId}/edit`);
}
