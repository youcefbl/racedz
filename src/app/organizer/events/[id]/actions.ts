"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementError, createOrganizerRaceAnnouncement } from "@/lib/announcements";
import {
  cancelOrganizerRaceRegistration,
  confirmOrganizerRegistrationPayment,
  requireApprovedOrganizer,
  updateOrganizerRaceRegistrationStatus
} from "@/lib/organizer";

export async function updateRegistrationStatusAction(formData: FormData) {
  const { organization } = await requireApprovedOrganizer();
  const raceId = getString(formData, "raceId");
  const registrationStatus = getString(formData, "registrationStatus");

  if (
    registrationStatus !== "OPEN" &&
    registrationStatus !== "CLOSED" &&
    registrationStatus !== "FULL" &&
    registrationStatus !== "CANCELLED"
  ) {
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

export async function createOrganizerAnnouncementAction(formData: FormData) {
  const { organization, session } = await requireApprovedOrganizer();
  const raceId = getString(formData, "raceId");

  try {
    await createOrganizerRaceAnnouncement({
      organizationId: organization.id,
      authorId: session.user.id,
      input: {
        raceId,
        title: getString(formData, "title"),
        body: getString(formData, "body")
      }
    });
  } catch (error) {
    if (error instanceof AnnouncementError) {
      throw new Error(error.message);
    }

    throw error;
  }

  revalidatePath("/organizer/events");
  revalidatePath(`/organizer/events/${raceId}`);
  revalidatePath("/races");
}

export async function confirmOrganizerRegistrationPaymentAction(formData: FormData) {
  const { organization } = await requireApprovedOrganizer();
  const raceId = getString(formData, "raceId");

  await confirmOrganizerRegistrationPayment({
    organizationId: organization.id,
    registrationId: getString(formData, "id")
  });

  revalidatePath(`/organizer/events/${raceId}/registrations`);
  revalidatePath(`/organizer/events/${raceId}`);
}

export async function cancelOrganizerRegistrationAction(formData: FormData) {
  const { organization } = await requireApprovedOrganizer();
  const raceId = getString(formData, "raceId");

  await cancelOrganizerRaceRegistration({
    organizationId: organization.id,
    registrationId: getString(formData, "id")
  });

  revalidatePath(`/organizer/events/${raceId}/registrations`);
  revalidatePath(`/organizer/events/${raceId}`);
  revalidatePath("/races");
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
