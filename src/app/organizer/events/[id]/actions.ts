"use server";

import { revalidatePath } from "next/cache";
import { updateOrganizerRaceRegistrationStatus, requireApprovedOrganizer } from "@/lib/organizer";

export async function updateRegistrationStatusAction(formData: FormData) {
  const { organization } = await requireApprovedOrganizer();
  const raceId = getString(formData, "raceId");
  const registrationStatus = getString(formData, "registrationStatus");

  if (registrationStatus !== "OPEN" && registrationStatus !== "CLOSED") {
    throw new Error("Invalid registration status");
  }

  await updateOrganizerRaceRegistrationStatus({
    organizationId: organization.id,
    raceEventId: raceId,
    registrationStatus
  });

  revalidatePath("/organizer/events");
  revalidatePath(`/organizer/events/${raceId}`);
  revalidatePath("/races");
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
