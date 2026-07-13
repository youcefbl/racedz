"use server";

import { redirect } from "next/navigation";
import { notifyAdminsRacePendingReview } from "@/lib/notifications";
import { createOrganizerRace, OrganizerError, requireApprovedOrganizer } from "@/lib/organizer";

export type OrganizerRaceActionState = {
  error?: string;
};

export async function createOrganizerRaceAction(
  _previousState: OrganizerRaceActionState,
  formData: FormData
): Promise<OrganizerRaceActionState> {
  const { organization } = await requireApprovedOrganizer();
  let raceId = "";
  let raceTitle = "";

  try {
    const race = await createOrganizerRace({
      organizationId: organization.id,
      input: {
        title: getString(formData, "title"),
        description: getString(formData, "description"),
        elevationGainText: getOptionalString(formData, "elevationGainText"),
        shirtEnabled: formData.get("shirtEnabled") === "on",
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
        baridiMobNumber: getOptionalString(formData, "baridiMobNumber"),
        ccpAccount: getOptionalString(formData, "ccpAccount"),
        ccpKey: getOptionalString(formData, "ccpKey"),
        paymentNote: getOptionalString(formData, "paymentNote"),
        mainImageUrl: getOptionalString(formData, "mainImageUrl"),
        maxParticipants: getOptionalString(formData, "maxParticipants"),
        autoCancelUnpaidAfterHours: getAutoCancelUnpaidAfterHours(formData),
        categoryName: getString(formData, "categoryName"),
        distanceKm: getString(formData, "distanceKm"),
        priceDzd: getOptionalString(formData, "priceDzd"),
        categoryMaxParticipants: getOptionalString(formData, "categoryMaxParticipants"),
        startTime: getOptionalString(formData, "categoryStartTime"),
        categories: getCategoryRows(formData)
      }
    });

    raceId = race.id;
    raceTitle = race.title;
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  if (raceId && raceTitle) {
    await notifyAdminsRacePendingReview({
      raceId,
      raceTitle,
      organizationName: organization.name
    });
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

function getAutoCancelUnpaidAfterHours(formData: FormData) {
  return formData.get("autoCancelUnpaidAfterHours") === "48" ? "48" : undefined;
}

function getCategoryRows(formData: FormData) {
  const names = getStrings(formData, "categoryName");
  const raceTypes = getStrings(formData, "categoryRaceType");
  const distances = getStrings(formData, "distanceKm");
  const prices = getStrings(formData, "priceDzd");
  const capacities = getStrings(formData, "categoryMaxParticipants");
  const startTimes = getStrings(formData, "categoryStartTime");

  return names
    .map((name, index) => ({
      name,
      raceType: raceTypes[index] || getString(formData, "raceType"),
      distanceKm: distances[index],
      priceDzd: prices[index] || undefined,
      maxParticipants: capacities[index] || undefined,
      startTime: startTimes[index] || undefined
    }))
    .filter((category) => category.name.length > 0 || category.distanceKm.length > 0);
}

function getStrings(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value.trim() : ""));
}
