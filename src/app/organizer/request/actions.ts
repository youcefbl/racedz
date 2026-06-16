"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createOrganizationRequestForUser, OrganizationRequestError } from "@/lib/organizations";

export type OrganizationRequestActionState = {
  error?: string;
};

export async function requestOrganizationAction(
  _previousState: OrganizationRequestActionState,
  formData: FormData
): Promise<OrganizationRequestActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/organizer/request");
  }

  try {
    await createOrganizationRequestForUser(session.user.id, {
      name: getString(formData, "name"),
      description: getString(formData, "description"),
      email: getString(formData, "email"),
      phone: getString(formData, "phone"),
      wilaya: getString(formData, "wilaya"),
      city: getString(formData, "city"),
      commune: getOptionalString(formData, "commune"),
      website: getOptionalString(formData, "website"),
      facebookUrl: getOptionalString(formData, "facebookUrl"),
      instagramUrl: getOptionalString(formData, "instagramUrl")
    });
  } catch (error) {
    if (error instanceof OrganizationRequestError) {
      return { error: error.message };
    }

    throw error;
  }

  redirect("/organizer/request?submitted=1");
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value || undefined;
}
