"use server";

import { revalidatePath } from "next/cache";
import { OrganizerError, requireApprovedOrganizer, updateOrganizationProfile } from "@/lib/organizer";

export type OrganizationSettingsActionState = {
  error?: string;
  success?: string;
};

export async function updateOrganizationSettingsAction(
  _previousState: OrganizationSettingsActionState,
  formData: FormData
): Promise<OrganizationSettingsActionState> {
  const { organization, membership } = await requireApprovedOrganizer();

  try {
    await updateOrganizationProfile({
      organizationId: organization.id,
      actorRole: membership.role,
      input: {
        name: getString(formData, "name"),
        description: getString(formData, "description"),
        email: getString(formData, "email"),
        phone: getString(formData, "phone"),
        logoUrl: getOptionalString(formData, "logoUrl"),
        wilaya: getString(formData, "wilaya"),
        city: getString(formData, "city"),
        commune: getOptionalString(formData, "commune"),
        website: getOptionalString(formData, "website"),
        facebookUrl: getOptionalString(formData, "facebookUrl"),
        instagramUrl: getOptionalString(formData, "instagramUrl")
      }
    });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/organizer");
  revalidatePath("/organizer/settings");
  revalidatePath("/admin/organizations");

  return { success: "Organization settings saved." };
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value || undefined;
}
