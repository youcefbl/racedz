"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AdminError, createPlatformRace, requireAdmin } from "@/lib/admin";
import { revalidateRacesCache } from "@/lib/race-repository";

export type PlatformRaceActionState = {
  error?: string;
};

export async function createPlatformRaceAction(
  _previousState: PlatformRaceActionState,
  formData: FormData
): Promise<PlatformRaceActionState> {
  const session = await requireAdmin();

  if (session.user.role !== "SUPERADMIN") {
    return { error: "Only superadmins can create platform races." };
  }

  let slug = "";

  try {
    const race = await createPlatformRace({
      title: getString(formData, "title"),
      description: getString(formData, "description"),
      elevationGainText: getOptionalString(formData, "elevationGainText"),
      shirtEnabled: formData.get("shirtEnabled") === "on",
      conditions: getOptionalString(formData, "conditions"),
      raceType: getString(formData, "raceType"),
      registrationStatus: getString(formData, "registrationStatus"),
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
      categoryName: getString(formData, "categoryName"),
      distanceKm: getString(formData, "distanceKm"),
      priceDzd: getOptionalString(formData, "priceDzd"),
      categoryMaxParticipants: getOptionalString(formData, "categoryMaxParticipants"),
      startTime: getOptionalString(formData, "categoryStartTime"),
      categories: getCategoryRows(formData),
      organizerName: getString(formData, "organizerName"),
      organizerUrl: getOptionalString(formData, "organizerUrl"),
      mainImageUrl: getOptionalString(formData, "mainImageUrl")
    });

    slug = race.slug;
  } catch (error) {
    if (error instanceof AdminError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/admin/races");
  revalidatePath("/races");
  revalidateRacesCache();
  redirect(`/admin/races?created=${slug}`);
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
