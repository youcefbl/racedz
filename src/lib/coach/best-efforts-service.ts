import { getPrisma } from "@/lib/db";
import type { RunRoutePoint } from "@/components/coach/types";
import { BEST_EFFORT_DISTANCES_M, computeBestEfforts, roundEffortSeconds } from "@/lib/coach/best-efforts";

/**
 * Persisted best efforts and the personal-record comparison (NATRUN-06.3).
 *
 * The rule the owner set: never scan a runner's history on read. Efforts are derived once per run
 * — at save for new runs, on a one-time backfill for older ones — into `RunBestEffort`, and a PR
 * is one indexed lookup per distance. Only VALID GPS/imported runs with a timestamped route ever
 * get rows; everything else is stamped as computed with none, so it is not re-examined.
 */

/** Sources that carry a measured route. MANUAL entries have no timestamps and never qualify. */
const ROUTE_SOURCES = ["GPS", "IMPORTED"] as const;

/** Upper bound on the one-time backfill per request, so a long history is chipped at, not scanned. */
const BACKFILL_BATCH = 200;

export type BestEffortDto = {
  distanceM: number;
  seconds: number;
  isPersonalBest: boolean;
};

/**
 * Derives and stores the efforts for one run, replacing any earlier rows. Idempotent. Safe to call
 * for any run: an ineligible one is stamped computed with zero rows.
 */
export async function computeAndStoreBestEfforts(runId: string): Promise<void> {
  const prisma = getPrisma();
  const run = await prisma.runnerRun.findUnique({
    where: { id: runId },
    select: { id: true, userId: true, route: true, validity: true, source: true, deletedAt: true },
  });
  if (!run) return;

  const eligible =
    run.deletedAt == null &&
    run.validity === "VALID" &&
    (ROUTE_SOURCES as readonly string[]).includes(run.source) &&
    Array.isArray(run.route);

  const efforts = eligible ? computeBestEfforts(run.route as RunRoutePoint[]) : [];

  await prisma.$transaction([
    prisma.runBestEffort.deleteMany({ where: { runId } }),
    ...(efforts.length > 0
      ? [
          prisma.runBestEffort.createMany({
            data: efforts.map((e) => ({
              runId,
              userId: run.userId,
              distanceM: e.distanceM,
              seconds: roundEffortSeconds(e.seconds),
              startIndex: e.startIndex,
              endIndex: e.endIndex,
            })),
          }),
        ]
      : []),
    prisma.runnerRun.update({ where: { id: runId }, data: { bestEffortsComputedAt: new Date() } }),
  ]);
}

/**
 * One-time lazy backfill for a runner: every not-yet-analysed run gets its rows (or its "none"
 * stamp). Bounded per call; a runner with more history than the batch finishes over a few reads.
 * Ordered oldest-first so the PR comparison for older runs settles before newer ones are opened.
 */
export async function ensureBestEffortsBackfilled(userId: string): Promise<void> {
  const prisma = getPrisma();
  const pending = await prisma.runnerRun.findMany({
    where: { userId, bestEffortsComputedAt: null, deletedAt: null },
    select: { id: true },
    orderBy: { startedAt: "asc" },
    take: BACKFILL_BATCH,
  });
  for (const row of pending) {
    try {
      await computeAndStoreBestEfforts(row.id);
    } catch (error) {
      // One bad route must not block the rest of the history; the run stays unstamped and is
      // retried on a later read.
      console.error("[best-efforts] backfill failed for a run", error);
    }
  }
}

/**
 * The run's efforts with the PR flag resolved.
 *
 * A PR is strictly the fastest among the runner's eligible runs at that distance. Ties do not earn
 * one — except that the earliest run of a tie keeps it, so a record is never taken away by an
 * equal later run. Eligibility of the *other* runs is enforced at write time (only VALID,
 * undeleted, route-carrying runs have rows) and re-checked here against soft deletes.
 */
export async function bestEffortsForRun(userId: string, runId: string): Promise<BestEffortDto[]> {
  const prisma = getPrisma();
  const rows = await prisma.runBestEffort.findMany({
    where: { runId, userId },
    select: { distanceM: true, seconds: true, run: { select: { startedAt: true } } },
    orderBy: { distanceM: "asc" },
  });
  if (rows.length === 0) return [];

  const out: BestEffortDto[] = [];
  for (const row of rows) {
    const faster = await prisma.runBestEffort.findFirst({
      where: {
        userId,
        distanceM: row.distanceM,
        runId: { not: runId },
        run: { deletedAt: null, validity: "VALID" },
        OR: [
          { seconds: { lt: row.seconds } },
          { seconds: row.seconds, run: { startedAt: { lt: row.run.startedAt } } },
          // Identical time AND identical start (imports of the same file): one of them must
          // still lose, deterministically.
          { seconds: row.seconds, run: { startedAt: row.run.startedAt }, runId: { lt: runId } },
        ],
      },
      select: { id: true },
    });
    out.push({ distanceM: row.distanceM, seconds: row.seconds, isPersonalBest: faster == null });
  }
  return out;
}

export { BEST_EFFORT_DISTANCES_M };
