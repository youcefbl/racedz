"use server";

import { revalidatePath } from "next/cache";
import {
  inviteOrganizationUser,
  OrganizerError,
  removeOrganizationMember,
  requireApprovedOrganizer,
  updateOrganizationMemberRole
} from "@/lib/organizer";

export type InviteMemberActionState = {
  error?: string;
  success?: string;
};

export type ManageMemberActionState = {
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

  return { success: "Invitation created. Copy the pending invite link and send it to the teammate." };
}

export async function updateMemberRoleAction(
  _previousState: ManageMemberActionState,
  formData: FormData
): Promise<ManageMemberActionState> {
  const { membership, organization } = await requireApprovedOrganizer();
  const role = getString(formData, "role");

  if (role !== "OWNER" && role !== "ADMIN" && role !== "MEMBER") {
    return { error: "Choose a valid member role." };
  }

  try {
    await updateOrganizationMemberRole({
      organizationId: organization.id,
      actorMemberId: membership.id,
      actorRole: membership.role,
      targetMemberId: getString(formData, "memberId"),
      role
    });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/organizer/members");

  return { success: "Member role updated." };
}

export async function removeMemberAction(
  _previousState: ManageMemberActionState,
  formData: FormData
): Promise<ManageMemberActionState> {
  const { membership, organization } = await requireApprovedOrganizer();

  try {
    await removeOrganizationMember({
      organizationId: organization.id,
      actorMemberId: membership.id,
      actorRole: membership.role,
      targetMemberId: getString(formData, "memberId")
    });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/organizer/members");

  return { success: "Member removed." };
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
