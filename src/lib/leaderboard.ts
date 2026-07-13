import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";

export type LeaderboardEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  wilaya: string | null;
  distanceKm: number;
  paceSecondsPerKm: number;
  startedAt: Date;
};

export type WilayaLeaderboards = {
  pace: LeaderboardEntry[];
  distance: LeaderboardEntry[];
};

const TOP_N = 20;
// Pace ranking needs a fairness floor so a 200m sprint can't top the board.
const MIN_PACE_DISTANCE_KM = 1;

/**
 * Per-wilaya public leaderboards: each runner's single best public run, ranked.
 * - `pace`: fastest average pace (over runs >= 1 km).
 * - `distance`: longest single run.
 * `wilaya` empty = all of Algeria. `monthly` limits to the current calendar month.
 */
export async function getWilayaLeaderboards(options: { wilaya?: string; monthly?: boolean }): Promise<WilayaLeaderboards> {
  const prisma = getPrisma();
  const wilaya = options.wilaya?.trim() ?? "";
  const wilayaCondition = wilaya ? Prisma.sql`AND u."wilaya" = ${wilaya}` : Prisma.empty;
  const monthCondition = options.monthly ? Prisma.sql`AND r."startedAt" >= date_trunc('month', NOW())` : Prisma.empty;

  const [pace, distance] = await Promise.all([
    prisma.$queryRaw<LeaderboardEntry[]>`
      SELECT * FROM (
        SELECT DISTINCT ON (r."userId")
          r."userId" AS "userId",
          CONCAT(u."firstName", ' ', u."lastName") AS "name",
          u."avatarUrl" AS "avatarUrl",
          u."wilaya" AS "wilaya",
          r."distanceKm" AS "distanceKm",
          r."averagePaceSecondsPerKm" AS "paceSecondsPerKm",
          r."startedAt" AS "startedAt"
        FROM "RunnerRun" r
        INNER JOIN "User" u ON u."id" = r."userId"
        WHERE r."isPublic" = true AND u."profilePrivate" = false AND r."distanceKm" >= ${MIN_PACE_DISTANCE_KM}
          ${wilayaCondition}
          ${monthCondition}
        ORDER BY r."userId", r."averagePaceSecondsPerKm" ASC
      ) best
      ORDER BY best."paceSecondsPerKm" ASC
      LIMIT ${TOP_N}
    `,
    prisma.$queryRaw<LeaderboardEntry[]>`
      SELECT * FROM (
        SELECT DISTINCT ON (r."userId")
          r."userId" AS "userId",
          CONCAT(u."firstName", ' ', u."lastName") AS "name",
          u."avatarUrl" AS "avatarUrl",
          u."wilaya" AS "wilaya",
          r."distanceKm" AS "distanceKm",
          r."averagePaceSecondsPerKm" AS "paceSecondsPerKm",
          r."startedAt" AS "startedAt"
        FROM "RunnerRun" r
        INNER JOIN "User" u ON u."id" = r."userId"
        WHERE r."isPublic" = true AND u."profilePrivate" = false
          ${wilayaCondition}
          ${monthCondition}
        ORDER BY r."userId", r."distanceKm" DESC
      ) best
      ORDER BY best."distanceKm" DESC
      LIMIT ${TOP_N}
    `
  ]);

  return { pace, distance };
}
