import "server-only";

import { getPrisma } from "@/lib/db";

// The social layer: a lightweight follow graph, an activity feed of public runs from people you
// follow, and kudos (likes). This is the community surface the app was missing — a reason to open
// it between races. Deliberately minimal: no comments/DMs yet (see TIER1_PROGRESS.md).

export type FeedRun = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorWilaya: string | null;
  startedAt: string;
  distanceKm: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number;
  title: string | null;
  kudosCount: number;
  hasKudoed: boolean;
  isOwn: boolean;
};

export type SocialProfile = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  wilaya: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isSelf: boolean;
};

// Follow / unfollow is idempotent and self-toggling: calling it flips the current state so a single
// button can drive it. Returns the resulting state. Following yourself is a no-op.
export async function toggleFollow(followerId: string, followingId: string): Promise<{ following: boolean }> {
  if (followerId === followingId) return { following: false };
  const prisma = getPrisma();
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } }
  });
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return { following: false };
  }
  // Guard against following a ghost id, and don't allow following a private profile.
  const target = await prisma.user.findUnique({ where: { id: followingId }, select: { id: true, profilePrivate: true } });
  if (!target || target.profilePrivate) return { following: false };
  await prisma.follow.create({ data: { followerId, followingId } });
  return { following: true };
}

export async function getSocialProfile(viewerId: string | null, userId: string): Promise<SocialProfile | null> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      wilaya: true,
      _count: { select: { followers: true, following: true } }
    }
  });
  if (!user) return null;

  const isFollowing = viewerId
    ? Boolean(
        await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
          select: { id: true }
        })
      )
    : false;

  return {
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    avatarUrl: user.avatarUrl,
    wilaya: user.wilaya,
    followerCount: user._count.followers,
    followingCount: user._count.following,
    isFollowing,
    isSelf: viewerId === userId
  };
}

// Toggle kudos on a run. Only public runs (or the caller's own) can be kudos'd. Returns the new
// state and the fresh count so the UI can render optimistically then reconcile.
export async function toggleKudos(userId: string, runId: string): Promise<{ kudoed: boolean; count: number }> {
  const prisma = getPrisma();
  const run = await prisma.runnerRun.findUnique({ where: { id: runId }, select: { id: true, userId: true, isPublic: true } });
  if (!run || (!run.isPublic && run.userId !== userId)) {
    throw new Error("RUN_NOT_FOUND");
  }
  const existing = await prisma.runKudos.findUnique({ where: { runId_userId: { runId, userId } }, select: { id: true } });
  if (existing) {
    await prisma.runKudos.delete({ where: { id: existing.id } });
  } else {
    await prisma.runKudos.create({ data: { runId, userId } });
  }
  const count = await prisma.runKudos.count({ where: { runId } });
  return { kudoed: !existing, count };
}

// The feed: public runs from people the viewer follows, plus the viewer's own runs, newest first.
// Cursor pagination on run id (createdAt-ordered). A brand-new user with no follows still sees
// their own runs, so the feed is never empty for an active runner.
export async function getFeed(
  userId: string,
  options: { cursor?: string | null; limit?: number } = {}
): Promise<{ runs: FeedRun[]; nextCursor: string | null }> {
  const prisma = getPrisma();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const followingRows = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  const authorIds = [...followingRows.map((row) => row.followingId), userId];

  const rows = await prisma.runnerRun.findMany({
    where: {
      userId: { in: authorIds },
      // Own runs always show; others' runs only when public AND the author's profile isn't private.
      OR: [{ userId }, { AND: [{ isPublic: true }, { user: { profilePrivate: false } }] }]
    },
    orderBy: { startedAt: "desc" },
    take: limit + 1, // fetch one extra to derive nextCursor
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      userId: true,
      startedAt: true,
      distanceKm: true,
      durationSeconds: true,
      averagePaceSecondsPerKm: true,
      title: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true, wilaya: true } },
      _count: { select: { kudos: true } },
      kudos: { where: { userId }, select: { id: true }, take: 1 }
    }
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const runs: FeedRun[] = page.map((row) => ({
    id: row.id,
    userId: row.userId,
    authorName: `${row.user.firstName} ${row.user.lastName}`.trim() || "Runner",
    authorAvatarUrl: row.user.avatarUrl,
    authorWilaya: row.user.wilaya,
    startedAt: row.startedAt.toISOString(),
    distanceKm: row.distanceKm,
    durationSeconds: row.durationSeconds,
    averagePaceSecondsPerKm: row.averagePaceSecondsPerKm,
    title: row.title,
    kudosCount: row._count.kudos,
    hasKudoed: row.kudos.length > 0,
    isOwn: row.userId === userId
  }));

  return { runs, nextCursor: hasMore ? page[page.length - 1]!.id : null };
}
