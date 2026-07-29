import "server-only";

import { getPrisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { notifyAddedToGroup, notifyGroupMemberRemoved, notifyGroupRoleChanged, sendGroupInviteEmailToNonUser } from "@/lib/notifications";

// Private (default) or public run-clubs. Membership — not the public Follow graph — controls
// visibility here: only fellow members of a shared group ever see each other's runs through it.
// The creator is the first ADMIN; ADMIN members can add/remove members and promote/demote other
// admins, but every group must keep at least one ADMIN (mirrors the "every organization must keep
// an owner" rule in src/lib/organizer.ts).

export class GroupError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GroupError";
    this.status = status;
  }
}

function getAppUrl() {
  return (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://127.0.0.1:3003").replace(/\/+$/, "");
}

export function groupJoinUrl(joinToken: string): string {
  return `${getAppUrl()}/groups/join/${joinToken}`;
}

export type GroupSummary = {
  id: string;
  name: string;
  pictureUrl: string | null;
  isPrivate: boolean;
  memberCount: number;
  role: "ADMIN" | "MEMBER";
};

// Groups the viewer belongs to, most recently joined first.
export async function getUserGroups(userId: string): Promise<GroupSummary[]> {
  const memberships = await getPrisma().groupMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    select: {
      role: true,
      group: { select: { id: true, name: true, pictureUrl: true, isPrivate: true, _count: { select: { members: true } } } }
    }
  });
  return memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    pictureUrl: m.group.pictureUrl,
    isPrivate: m.group.isPrivate,
    memberCount: m.group._count.members,
    role: m.role
  }));
}

// Public groups not already joined, for a lightweight "discover" list — the only thing that
// actually distinguishes a public group from a private one (both use the same join-link
// mechanism otherwise). No search, just the most recent ones; a runner can join directly from
// this list without needing the share link at all.
export async function listDiscoverableGroups(userId: string, limit = 10): Promise<GroupSummary[]> {
  const prisma = getPrisma();
  const memberOf = await prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } });
  const excludeIds = memberOf.map((m) => m.groupId);

  const groups = await prisma.group.findMany({
    where: { isPrivate: false, id: { notIn: excludeIds } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
    select: { id: true, name: true, pictureUrl: true, isPrivate: true, _count: { select: { members: true } } }
  });
  return groups.map((g) => ({ id: g.id, name: g.name, pictureUrl: g.pictureUrl, isPrivate: g.isPrivate, memberCount: g._count.members, role: "MEMBER" as const }));
}

// Join a public group directly by id (skips the share-link/token indirection, since a group
// listed in the public directory needs no invite to join). Refuses a private group — those must
// go through joinGroupByToken, so a stale/guessed id can't bypass the "you need the link" rule.
export async function joinPublicGroup(userId: string, groupId: string): Promise<{ groupName: string }> {
  const group = await getPrisma().group.findUnique({ where: { id: groupId }, select: { id: true, name: true, isPrivate: true } });
  if (!group || group.isPrivate) throw new GroupError("This group is not open to join directly.", 404);

  await getPrisma().groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: {},
    create: { groupId, userId, role: "MEMBER" }
  });
  return { groupName: group.name };
}

export async function createGroup(
  userId: string,
  input: { name: string; pictureUrl?: string | null; isPrivate: boolean }
): Promise<GroupSummary> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    throw new GroupError("Group name must be between 2 and 60 characters.");
  }
  const group = await getPrisma().group.create({
    data: {
      name,
      pictureUrl: input.pictureUrl || null,
      isPrivate: input.isPrivate,
      createdById: userId,
      members: { create: { userId, role: "ADMIN" } }
    }
  });
  return { id: group.id, name: group.name, pictureUrl: group.pictureUrl, isPrivate: group.isPrivate, memberCount: 1, role: "ADMIN" };
}

export type GroupMemberRow = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
  isSelf: boolean;
};

export type GroupDetail = {
  id: string;
  name: string;
  pictureUrl: string | null;
  isPrivate: boolean;
  joinUrl: string;
  createdById: string;
  viewerRole: "ADMIN" | "MEMBER";
  members: GroupMemberRow[];
};

// Full detail + member list. Returns null if the group doesn't exist or the viewer isn't a
// member — group membership itself, and everything scoped to it, is private information.
export async function getGroupDetail(userId: string, groupId: string): Promise<GroupDetail | null> {
  const prisma = getPrisma();
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true }
  });
  if (!membership) return null;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      pictureUrl: true,
      isPrivate: true,
      joinToken: true,
      createdById: true,
      members: {
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        select: { id: true, userId: true, role: true, joinedAt: true, user: { select: { firstName: true, lastName: true, avatarUrl: true } } }
      }
    }
  });
  if (!group) return null;

  return {
    id: group.id,
    name: group.name,
    pictureUrl: group.pictureUrl,
    isPrivate: group.isPrivate,
    joinUrl: groupJoinUrl(group.joinToken),
    createdById: group.createdById,
    viewerRole: membership.role,
    members: group.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: `${m.user.firstName} ${m.user.lastName}`.trim() || "Runner",
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      isSelf: m.userId === userId
    }))
  };
}

export type GroupFeedRun = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  startedAt: string;
  distanceKm: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number;
  title: string | null;
};

// Runs from every member of the group (including the viewer), newest first. Deliberately does
// NOT filter on RunnerRun.isPublic — that flag governs the *public* Follow-based feed and
// leaderboards, and a private group's whole point is sharing without also having to make every
// run publicly visible. Group membership itself is the access control. Still validity-filtered
// like every other stats/social surface — a car drive still shouldn't show up here either.
export async function getGroupFeed(userId: string, groupId: string, limit = 30): Promise<GroupFeedRun[]> {
  const prisma = getPrisma();
  const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { id: true } });
  if (!membership) throw new GroupError("You're not a member of this group.", 403);

  const memberRows = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  const memberIds = memberRows.map((m) => m.userId);

  const rows = await prisma.runnerRun.findMany({
    where: { userId: { in: memberIds }, validity: "VALID" },
    orderBy: { startedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
    select: {
      id: true,
      userId: true,
      startedAt: true,
      distanceKm: true,
      durationSeconds: true,
      averagePaceSecondsPerKm: true,
      title: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    authorName: `${row.user.firstName} ${row.user.lastName}`.trim() || "Runner",
    authorAvatarUrl: row.user.avatarUrl,
    startedAt: row.startedAt.toISOString(),
    distanceKm: row.distanceKm,
    durationSeconds: row.durationSeconds,
    averagePaceSecondsPerKm: row.averagePaceSecondsPerKm,
    title: row.title
  }));
}

export type GroupJoinPreview = {
  id: string;
  name: string;
  pictureUrl: string | null;
  isPrivate: boolean;
  memberCount: number;
};

// Read-only lookup for the join-link landing page. Never joins or mutates anything — deliberately
// separate from joinGroupByToken so a bot/preview crawler fetching the link (Slack/Twitter/etc.
// unfurling a shared URL) can never join someone by accident, mirroring why /invite/[token] shows
// a confirm button rather than auto-accepting on page load.
export async function getGroupPreviewByToken(token: string): Promise<GroupJoinPreview | null> {
  const group = await getPrisma().group.findUnique({
    where: { joinToken: token },
    select: { id: true, name: true, pictureUrl: true, isPrivate: true, _count: { select: { members: true } } }
  });
  if (!group) return null;
  return { id: group.id, name: group.name, pictureUrl: group.pictureUrl, isPrivate: group.isPrivate, memberCount: group._count.members };
}

// Joining via the share link is silent (no notification) and idempotent — clicking an already-
// joined link, or a public link seen by many people, must never error or double-notify.
export async function joinGroupByToken(userId: string, token: string): Promise<{ groupId: string; groupName: string }> {
  const group = await getPrisma().group.findUnique({ where: { joinToken: token }, select: { id: true, name: true } });
  if (!group) throw new GroupError("This invite link is invalid or has expired.", 404);

  await getPrisma().groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    update: {},
    create: { groupId: group.id, userId, role: "MEMBER" }
  });
  return { groupId: group.id, groupName: group.name };
}

// Only an ADMIN may manage other members; nobody (including an admin) can change or remove their
// own membership through this path — that's `leaveGroup` instead, which has its own "don't orphan
// the group" guard.
function assertCanManageGroupMember({
  actorRole,
  actorUserId,
  targetUserId
}: {
  actorRole: "ADMIN" | "MEMBER";
  actorUserId: string;
  targetUserId: string;
}) {
  if (actorRole !== "ADMIN") {
    throw new GroupError("Only group admins can manage members.", 403);
  }
  if (actorUserId === targetUserId) {
    throw new GroupError("You can't change or remove your own membership this way — use Leave group instead.", 400);
  }
}

async function assertGroupKeepsAdmin(
  tx: Pick<ReturnType<typeof getPrisma>, "groupMember">,
  groupId: string
) {
  const adminCount = await tx.groupMember.count({ where: { groupId, role: "ADMIN" } });
  if (adminCount <= 1) {
    throw new GroupError("A group must always keep at least one admin.", 409);
  }
}

export async function updateGroupMemberRole({
  groupId,
  actorUserId,
  targetUserId,
  role
}: {
  groupId: string;
  actorUserId: string;
  targetUserId: string;
  role: "ADMIN" | "MEMBER";
}) {
  const { groupName, result } = await getPrisma().$transaction(async (tx) => {
    const actor = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: actorUserId } }, select: { role: true } });
    if (!actor) throw new GroupError("You're not a member of this group.", 403);

    const target = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      select: { id: true, role: true }
    });
    if (!target) throw new GroupError("That member was not found.", 404);

    assertCanManageGroupMember({ actorRole: actor.role, actorUserId, targetUserId });

    if (target.role === "ADMIN" && role !== "ADMIN") {
      await assertGroupKeepsAdmin(tx, groupId);
    }

    const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, select: { name: true } });
    const result = await tx.groupMember.update({ where: { id: target.id }, data: { role } });
    return { groupName: group.name, result };
  });

  await notifyGroupRoleChanged({ userId: targetUserId, groupId, groupName, role }).catch((error) => {
    console.error("[groups] failed to notify role change:", error);
  });
  return result;
}

export async function removeGroupMember({
  groupId,
  actorUserId,
  targetUserId
}: {
  groupId: string;
  actorUserId: string;
  targetUserId: string;
}) {
  const groupName = await getPrisma().$transaction(async (tx) => {
    const actor = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: actorUserId } }, select: { role: true } });
    if (!actor) throw new GroupError("You're not a member of this group.", 403);

    const target = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      select: { id: true, role: true }
    });
    if (!target) throw new GroupError("That member was not found.", 404);

    assertCanManageGroupMember({ actorRole: actor.role, actorUserId, targetUserId });

    if (target.role === "ADMIN") {
      await assertGroupKeepsAdmin(tx, groupId);
    }

    const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, select: { name: true } });
    await tx.groupMember.delete({ where: { id: target.id } });
    return group.name;
  });

  await notifyGroupMemberRemoved({ userId: targetUserId, groupName }).catch((error) => {
    console.error("[groups] failed to notify removed member:", error);
  });
}

// A member removing themselves. Unlike removeGroupMember, this IS self-service — but an admin
// leaving must still not orphan the group.
export async function leaveGroup(userId: string, groupId: string) {
  return getPrisma().$transaction(async (tx) => {
    const member = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { id: true, role: true } });
    if (!member) throw new GroupError("You're not a member of this group.", 403);
    if (member.role === "ADMIN") {
      await assertGroupKeepsAdmin(tx, groupId);
    }
    await tx.groupMember.delete({ where: { id: member.id } });
  });
}

export async function updateGroup(
  actorUserId: string,
  groupId: string,
  input: { name?: string; pictureUrl?: string | null; isPrivate?: boolean }
) {
  const actor = await getPrisma().groupMember.findUnique({ where: { groupId_userId: { groupId, userId: actorUserId } }, select: { role: true } });
  if (!actor || actor.role !== "ADMIN") throw new GroupError("Only group admins can edit the group.", 403);

  const data: { name?: string; pictureUrl?: string | null; isPrivate?: boolean } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 60) throw new GroupError("Group name must be between 2 and 60 characters.");
    data.name = name;
  }
  if (input.pictureUrl !== undefined) data.pictureUrl = input.pictureUrl || null;
  if (input.isPrivate !== undefined) data.isPrivate = input.isPrivate;

  return getPrisma().group.update({ where: { id: groupId }, data });
}

// Admin-only. If the email matches an existing account, they're added immediately (a group has no
// membership-approval step, unlike organizations) and notified in-app/push. Otherwise a
// standalone email is sent inviting them to sign up and then use the join link.
export async function inviteGroupMemberByEmail({
  groupId,
  actorUserId,
  email,
  locale
}: {
  groupId: string;
  actorUserId: string;
  email: string;
  locale: Locale;
}): Promise<{ added: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) throw new GroupError("Enter a valid email address.");

  const prisma = getPrisma();
  const actor = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: actorUserId } }, select: { role: true } });
  if (!actor || actor.role !== "ADMIN") throw new GroupError("Only group admins can invite people.", 403);

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, name: true, joinToken: true } });
  if (!group) throw new GroupError("Group not found.", 404);

  const inviter = await prisma.user.findUnique({ where: { id: actorUserId }, select: { firstName: true, lastName: true } });
  const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : "";

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  const joinUrl = groupJoinUrl(group.joinToken);

  if (existingUser) {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId: existingUser.id } },
      update: {},
      create: { groupId, userId: existingUser.id, role: "MEMBER" }
    });
    await notifyAddedToGroup({ userId: existingUser.id, groupId, groupName: group.name, inviterName }).catch((error) => {
      console.error("[groups] failed to notify added member:", error);
    });
    return { added: true };
  }

  await sendGroupInviteEmailToNonUser({ email: normalizedEmail, groupName: group.name, inviterName, joinUrl, locale }).catch((error) => {
    console.error("[groups] failed to send invite email:", error);
    throw new GroupError("Couldn't send the invite email. Please try again.", 502);
  });
  return { added: false };
}
