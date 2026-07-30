/**
 * PR-056/057 negative-path coverage for the groups moderation gaps closed in this pass:
 * updateGroup() being wired up, join-token rotation, and auto-rotation on member removal so a
 * kicked member (or anyone they shared the link with) can't instantly rejoin with the stale link.
 *
 * Requires DATABASE_URL pointed at a disposable/test DB (loaded from .env automatically if not
 * already exported). Seeds and cleans up after itself.
 * Run: npx tsx scripts/test-groups-moderation.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const tag = `groupmod-${process.pid}-${Date.now()}`;

let allOk = true;
const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!cond) allOk = false;
};

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const { createGroup, updateGroup, rotateGroupJoinToken, removeGroupMember, joinGroupByToken, getGroupPreviewByToken, GroupError } =
    await import("../src/lib/groups");
  const prisma = getPrisma();

  const admin = await prisma.user.create({ data: { email: `${tag}-admin@example.test`, firstName: "Admin", lastName: "A" } });
  const outsider = await prisma.user.create({ data: { email: `${tag}-outsider@example.test`, firstName: "Out", lastName: "B" } });
  const kickable = await prisma.user.create({ data: { email: `${tag}-kickable@example.test`, firstName: "Kick", lastName: "C" } });

  try {
    const group = await createGroup(admin.id, { name: `${tag} club`, isPrivate: true });

    // updateGroup: non-admin is rejected, admin succeeds.
    try {
      await updateGroup(outsider.id, group.id, { name: "hijacked name" });
      check("updateGroup rejects a non-member", false, "did not throw");
    } catch (err) {
      check("updateGroup rejects a non-member", err instanceof GroupError && err.status === 403, String(err));
    }
    const renamed = await updateGroup(admin.id, group.id, { name: `${tag} renamed`, isPrivate: false });
    check("updateGroup applies admin's changes", renamed.name === `${tag} renamed` && renamed.isPrivate === false, `name=${renamed.name} isPrivate=${renamed.isPrivate}`);

    // Capture the current join link, add `kickable` through it.
    const originalPreview = await getGroupPreviewByToken(await currentToken(prisma, group.id));
    check("original join link resolves before any rotation", originalPreview?.id === group.id, JSON.stringify(originalPreview));
    const tokenBeforeKick = await currentToken(prisma, group.id);
    await joinGroupByToken(kickable.id, tokenBeforeKick);
    const memberRow = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: kickable.id } } });
    check("kickable user joined via the link", memberRow !== null, `member=${memberRow?.id}`);

    // Kicking a member must rotate the token so the same stale link can't be reused.
    await removeGroupMember({ groupId: group.id, actorUserId: admin.id, targetUserId: kickable.id });
    const staleLinkPreview = await getGroupPreviewByToken(tokenBeforeKick);
    check("removal rotates the join token — old link is now invalid", staleLinkPreview === null, JSON.stringify(staleLinkPreview));
    try {
      await joinGroupByToken(kickable.id, tokenBeforeKick);
      check("removed member can't rejoin with the stale link", false, "did not throw");
    } catch (err) {
      check("removed member can't rejoin with the stale link", err instanceof GroupError, String(err));
    }

    // Explicit admin-triggered rotation also invalidates the current link and returns a fresh one.
    const tokenBeforeExplicitRotate = await currentToken(prisma, group.id);
    const { joinUrl } = await rotateGroupJoinToken(admin.id, group.id);
    check("rotateGroupJoinToken returns a usable new link", joinUrl.includes("/groups/join/"), joinUrl);
    const oldTokenAfterExplicitRotate = await getGroupPreviewByToken(tokenBeforeExplicitRotate);
    check("explicit rotation invalidates the previous link", oldTokenAfterExplicitRotate === null, JSON.stringify(oldTokenAfterExplicitRotate));
    try {
      await rotateGroupJoinToken(outsider.id, group.id);
      check("rotateGroupJoinToken rejects a non-admin", false, "did not throw");
    } catch (err) {
      check("rotateGroupJoinToken rejects a non-admin", err instanceof GroupError && err.status === 403, String(err));
    }
  } finally {
    const userIds = [admin.id, outsider.id, kickable.id];
    const groups = await prisma.group.findMany({ where: { createdById: { in: userIds } }, select: { id: true } });
    const groupIds = groups.map((g) => g.id);
    await prisma.groupMember.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.notificationDelivery.deleteMany({ where: { notification: { userId: { in: userIds } } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }

  if (!allOk) {
    console.error("Groups moderation checks FAILED.");
    process.exit(1);
  }
  console.log("Groups moderation (edit, join-token rotation, kick-invalidates-link) checks passed.");
}

async function currentToken(prisma: Awaited<ReturnType<typeof import("../src/lib/db").getPrisma>>, groupId: string): Promise<string> {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { joinToken: true } });
  return group.joinToken;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
