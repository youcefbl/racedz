"use server";

import { revalidatePath } from "next/cache";
import { inviteOrganizationUser, OrganizerError, requireApprovedOrganizer } from "@/lib/organizer";

export type InviteMemberActionState = {
  error?: string;
  success?: string;
};

export async function inviteMemberAction(
  _previousState: InviteMemberActionState,
  formData: FormData
): Promise<InviteMemberActionState> {
  const { membership, organization, session } = await requireApprovedOrganizer();

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only organization owners and admins can invite users." };
  }

  try {
    await inviteOrganizationUser({
      organizationId: organization.id,
      invitedById: session.user.id,
      input: {
        email: getString(formData, "email"),
        role: getString(formData, "role")
      }
    });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/organizer/members");

  return { success: "Invitation created. Email delivery will be wired later." };
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
