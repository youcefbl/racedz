"use server";

import { revalidatePath } from "next/cache";
import { sendNotificationEmail } from "@/lib/notifications/email-provider";
import { renderRaceDzEmailHtml, renderRaceDzEmailText } from "@/lib/notifications/email-template";
import {
  inviteOrganizationUser,
  OrganizerError,
  removeOrganizationMember,
  requireApprovedOrganizer,
  resendOrganizationInvitation,
  revokeOrganizationInvitation,
  updateOrganizationMemberRole
} from "@/lib/organizer";

export type InviteMemberActionState = {
  error?: string;
  success?: string;
  warning?: string;
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
    const invitation = await inviteOrganizationUser({
      organizationId: organization.id,
      invitedById: session.user.id,
      input: {
        email: getString(formData, "email"),
        role: getString(formData, "role")
      }
    });
    const emailResult = await sendOrganizationInviteEmail({
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      organizationName: organization.name
    });

    revalidatePath("/organizer/members");

    if (!emailResult.ok) {
      return {
        success: "Invitation created.",
        warning: `Email was not delivered: ${emailResult.error} Use the pending invite link below as a fallback.`
      };
    }
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/organizer/members");

  return { success: "Invitation created and email sent." };
}

export async function resendInvitationAction(
  _previousState: InviteMemberActionState,
  formData: FormData
): Promise<InviteMemberActionState> {
  const { membership, organization, session } = await requireApprovedOrganizer();

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only organization owners and admins can resend invitations." };
  }

  try {
    const invitation = await resendOrganizationInvitation({
      organizationId: organization.id,
      invitationId: getString(formData, "invitationId"),
      invitedById: session.user.id
    });
    const emailResult = await sendOrganizationInviteEmail({
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      organizationName: organization.name
    });

    revalidatePath("/organizer/members");

    if (!emailResult.ok) {
      return {
        success: "Invitation link refreshed.",
        warning: `Email was not delivered: ${emailResult.error} Use the pending invite link below as a fallback.`
      };
    }
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/organizer/members");

  return { success: "Invitation resent with a fresh link." };
}

export async function revokeInvitationAction(
  _previousState: ManageMemberActionState,
  formData: FormData
): Promise<ManageMemberActionState> {
  const { membership, organization } = await requireApprovedOrganizer();

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only organization owners and admins can revoke invitations." };
  }

  try {
    await revokeOrganizationInvitation({
      organizationId: organization.id,
      invitationId: getString(formData, "invitationId")
    });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/organizer/members");

  return { success: "Invitation revoked." };
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

function getAppUrl() {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://127.0.0.1:3003";
}

function sendOrganizationInviteEmail({
  email,
  role,
  token,
  organizationName
}: {
  email: string;
  role: string;
  token: string;
  organizationName: string;
}) {
  const inviteUrl = new URL(`/invite/${token}`, getAppUrl()).toString();

  return sendNotificationEmail({
    to: email,
    subject: `${organizationName} invited you to RaceDZ`,
    html: renderRaceDzEmailHtml({
      preheader: `${organizationName} invited you to help manage races on RaceDZ.`,
      title: "Organization invite",
      body: `${organizationName} invited you to join their RaceDZ organizer team as ${role.toLowerCase()}. Accept the invite to help manage races and participants.`,
      action: {
        label: "Accept invite",
        href: inviteUrl
      },
      meta: [
        { label: "Organization", value: organizationName },
        { label: "Role", value: role }
      ]
    }),
    text: renderRaceDzEmailText({
      title: "Organization invite",
      body: `${organizationName} invited you to join their RaceDZ organizer team as ${role.toLowerCase()}.`,
      action: {
        label: "Accept invite",
        href: inviteUrl
      },
      meta: [
        { label: "Organization", value: organizationName },
        { label: "Role", value: role }
      ]
    })
  });
}
