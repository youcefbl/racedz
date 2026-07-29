"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  GroupError,
  createGroup,
  inviteGroupMemberByEmail,
  joinPublicGroup,
  leaveGroup,
  removeGroupMember,
  updateGroupMemberRole
} from "@/lib/groups";
import { getLocale } from "@/lib/i18n";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export type GroupFormState = { error?: string; added?: boolean };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/groups");
  return session.user.id;
}

export async function createGroupAction(_prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const userId = await requireUserId();
  const rate = checkRateLimit(rateLimitKey("group-create", userId), 10, 60 * 60 * 1000);
  if (!rate.ok) return { error: "Too many groups created recently. Please try again later." };

  const name = String(formData.get("name") ?? "").trim();
  const pictureUrl = String(formData.get("pictureUrl") ?? "").trim();
  const isPrivate = formData.get("isPrivate") === "on";

  let groupId: string;
  try {
    const group = await createGroup(userId, { name, pictureUrl: pictureUrl || null, isPrivate });
    groupId = group.id;
  } catch (error) {
    if (error instanceof GroupError) return { error: error.message };
    throw error;
  }
  revalidatePath("/account/groups");
  redirect(`/account/groups/${groupId}`);
}

export async function inviteGroupMemberAction(_prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const userId = await requireUserId();
  const groupId = String(formData.get("groupId") ?? "");
  const email = String(formData.get("email") ?? "").trim();

  const rate = checkRateLimit(rateLimitKey("group-invite", userId), 20, 60 * 60 * 1000);
  if (!rate.ok) return { error: "Too many invites sent recently. Please try again later." };

  let added: boolean;
  try {
    const locale = getLocale((formData.get("lang") as string) ?? undefined);
    ({ added } = await inviteGroupMemberByEmail({ groupId, actorUserId: userId, email, locale }));
  } catch (error) {
    if (error instanceof GroupError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/account/groups/${groupId}`);
  return { added };
}

export async function updateGroupMemberRoleAction(formData: FormData) {
  const userId = await requireUserId();
  const groupId = String(formData.get("groupId") ?? "");
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "MEMBER";

  try {
    await updateGroupMemberRole({ groupId, actorUserId: userId, targetUserId, role });
  } catch (error) {
    if (!(error instanceof GroupError)) throw error;
    revalidatePath(`/account/groups/${groupId}`);
    redirect(`/account/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/account/groups/${groupId}`);
}

export async function removeGroupMemberAction(formData: FormData) {
  const userId = await requireUserId();
  const groupId = String(formData.get("groupId") ?? "");
  const targetUserId = String(formData.get("targetUserId") ?? "");

  try {
    await removeGroupMember({ groupId, actorUserId: userId, targetUserId });
  } catch (error) {
    if (!(error instanceof GroupError)) throw error;
    revalidatePath(`/account/groups/${groupId}`);
    redirect(`/account/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/account/groups/${groupId}`);
}

export async function leaveGroupAction(formData: FormData) {
  const userId = await requireUserId();
  const groupId = String(formData.get("groupId") ?? "");
  try {
    await leaveGroup(userId, groupId);
  } catch (error) {
    if (!(error instanceof GroupError)) throw error;
    // Can't leave (last admin) — send them back to the group with nothing else to do about it
    // from here; the member list still shows them as the sole admin.
    redirect(`/account/groups/${groupId}`);
  }
  revalidatePath("/account/groups");
  redirect("/account/groups");
}

export async function joinPublicGroupAction(formData: FormData) {
  const userId = await requireUserId();
  const groupId = String(formData.get("groupId") ?? "");
  await joinPublicGroup(userId, groupId);
  revalidatePath("/account/groups");
  redirect(`/account/groups/${groupId}`);
}
