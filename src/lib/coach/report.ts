import { getPrisma } from "@/lib/db";

// Coach operations report (observability). Aggregates, over a recent window, how runs are being
// logged, how the run→workout matcher is performing, workout outcomes, plan adherence, and AI usage
// + cost. Read-only and content-free — no message text, just counts and rates — so it's safe to
// surface to admins and cheap to poll while we tune the matcher and coaching loop.

export type CoachOpsReport = {
  windowDays: number;
  generatedAt: string;
  runs: {
    total: number;
    bySource: Record<string, number>;
    linked: number;
    free: number;
    linkedRate: number;
  };
  matches: {
    bySource: Record<string, number>;
    autoLinks: number;
    autoAvgConfidence: number | null;
  };
  workoutOutcomes: {
    completed: number;
    skipped: number;
    byCompletionType: Record<string, number>;
    bySkipReason: Record<string, number>;
    skipReasonUnknown: number;
  };
  adherence: {
    activePlans: number;
    sessions: number;
    completed: number;
    skipped: number;
    completionRate: number;
  };
  ai: {
    interactions: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    failureRate: number;
    requests: number;
    requestFailureRate: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
};

const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 1000 : 0);
const num = (v: unknown) => Number(v ?? 0);

export async function getCoachOpsReport(windowDays = 30, now: Date = new Date()): Promise<CoachOpsReport> {
  const days = Math.min(365, Math.max(1, Math.floor(windowDays)));
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prisma = getPrisma();

  const [runRows, matchRows, completionRows, skipRows, adherenceRows, interactionRows, usageRows] = await Promise.all([
    // Runs by source + linked/free split, over the window.
    prisma.$queryRaw<Array<{ source: string; total: bigint; linked: bigint }>>`
      SELECT "source"::text AS "source", COUNT(*) AS "total",
        COUNT(*) FILTER (WHERE "workoutId" IS NOT NULL) AS "linked"
      FROM "RunnerRun" WHERE "startedAt" >= ${since} GROUP BY "source"
    `,
    // Linked runs by match source + average AUTO confidence.
    prisma.$queryRaw<Array<{ source: string; total: bigint; avgConfidence: number | null }>>`
      SELECT "workoutMatchSource"::text AS "source", COUNT(*) AS "total", AVG("workoutMatchConfidence") AS "avgConfidence"
      FROM "RunnerRun" WHERE "startedAt" >= ${since} AND "workoutMatchSource" IS NOT NULL GROUP BY "workoutMatchSource"
    `,
    // Completed workouts in the window, by completion type.
    prisma.$queryRaw<Array<{ completionType: string | null; total: bigint }>>`
      SELECT "completionType"::text AS "completionType", COUNT(*) AS "total"
      FROM "TrainingWorkout" WHERE "status" = 'COMPLETED' AND "completedAt" >= ${since} GROUP BY "completionType"
    `,
    // Skipped workouts in the window, by reason (NULL = reason unknown, i.e. auto-closed, not yet asked).
    prisma.$queryRaw<Array<{ skipReason: string | null; total: bigint }>>`
      SELECT "skipReason"::text AS "skipReason", COUNT(*) AS "total"
      FROM "TrainingWorkout" WHERE "status" = 'SKIPPED' AND "skippedAt" >= ${since} GROUP BY "skipReason"
    `,
    // Current adherence across all ACTIVE plans (a snapshot, not windowed).
    prisma.$queryRaw<Array<{ activePlans: bigint; sessions: bigint; completed: bigint; skipped: bigint }>>`
      SELECT COUNT(DISTINCT p."id") AS "activePlans",
        COUNT(*) FILTER (WHERE w."workoutType" <> 'REST') AS "sessions",
        COUNT(*) FILTER (WHERE w."status" = 'COMPLETED') AS "completed",
        COUNT(*) FILTER (WHERE w."status" = 'SKIPPED') AS "skipped"
      FROM "TrainingPlan" p LEFT JOIN "TrainingWorkout" w ON w."trainingPlanId" = p."id"
      WHERE p."status" = 'ACTIVE'
    `,
    // AI coach interactions by type + status, over the window.
    prisma.$queryRaw<Array<{ type: string; status: string; total: bigint }>>`
      SELECT "type"::text AS "type", "status"::text AS "status", COUNT(*) AS "total"
      FROM "CoachInteraction" WHERE "createdAt" >= ${since} GROUP BY "type", "status"
    `,
    // AI provider requests + token/cost totals, over the window.
    prisma.$queryRaw<Array<{ status: string; total: bigint; inputTokens: bigint; outputTokens: bigint; costMicro: bigint }>>`
      SELECT "status"::text AS "status", COUNT(*) AS "total",
        COALESCE(SUM("inputTokens"), 0) AS "inputTokens", COALESCE(SUM("outputTokens"), 0) AS "outputTokens",
        COALESCE(SUM("estimatedCostMicroUsd"), 0) AS "costMicro"
      FROM "AiUsageLog" WHERE "createdAt" >= ${since} GROUP BY "status"
    `
  ]);

  // --- Runs ---
  const runsBySource: Record<string, number> = {};
  let runsTotal = 0;
  let runsLinked = 0;
  for (const row of runRows) {
    runsBySource[row.source] = num(row.total);
    runsTotal += num(row.total);
    runsLinked += num(row.linked);
  }

  // --- Matches ---
  const matchBySource: Record<string, number> = {};
  let autoLinks = 0;
  let autoAvgConfidence: number | null = null;
  for (const row of matchRows) {
    matchBySource[row.source] = num(row.total);
    if (row.source === "AUTO") {
      autoLinks = num(row.total);
      autoAvgConfidence = row.avgConfidence === null ? null : Math.round(Number(row.avgConfidence) * 100) / 100;
    }
  }

  // --- Workout outcomes ---
  const byCompletionType: Record<string, number> = {};
  let completedTotal = 0;
  for (const row of completionRows) {
    byCompletionType[row.completionType ?? "UNSPECIFIED"] = num(row.total);
    completedTotal += num(row.total);
  }
  const bySkipReason: Record<string, number> = {};
  let skippedTotal = 0;
  let skipReasonUnknown = 0;
  for (const row of skipRows) {
    if (row.skipReason === null) skipReasonUnknown = num(row.total);
    else bySkipReason[row.skipReason] = num(row.total);
    skippedTotal += num(row.total);
  }

  // --- Adherence (snapshot) ---
  const adh = adherenceRows[0];
  const adhCompleted = num(adh?.completed);
  const adhSkipped = num(adh?.skipped);

  // --- AI ---
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let interactions = 0;
  let interactionFailures = 0;
  for (const row of interactionRows) {
    const t = num(row.total);
    byType[row.type] = (byType[row.type] ?? 0) + t;
    byStatus[row.status] = (byStatus[row.status] ?? 0) + t;
    interactions += t;
    if (row.status === "FAILED") interactionFailures += t;
  }
  let requests = 0;
  let requestFailures = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let costMicro = 0;
  for (const row of usageRows) {
    const t = num(row.total);
    requests += t;
    if (row.status !== "SUCCESS" && row.status !== "SUCCEEDED") requestFailures += t;
    inputTokens += num(row.inputTokens);
    outputTokens += num(row.outputTokens);
    costMicro += num(row.costMicro);
  }

  return {
    windowDays: days,
    generatedAt: now.toISOString(),
    runs: {
      total: runsTotal,
      bySource: runsBySource,
      linked: runsLinked,
      free: runsTotal - runsLinked,
      linkedRate: rate(runsLinked, runsTotal)
    },
    matches: { bySource: matchBySource, autoLinks, autoAvgConfidence },
    workoutOutcomes: { completed: completedTotal, skipped: skippedTotal, byCompletionType, bySkipReason, skipReasonUnknown },
    adherence: {
      activePlans: num(adh?.activePlans),
      sessions: num(adh?.sessions),
      completed: adhCompleted,
      skipped: adhSkipped,
      completionRate: rate(adhCompleted, adhCompleted + adhSkipped)
    },
    ai: {
      interactions,
      byType,
      byStatus,
      failureRate: rate(interactionFailures, interactions),
      requests,
      requestFailureRate: rate(requestFailures, requests),
      inputTokens,
      outputTokens,
      estimatedCostUsd: Math.round((costMicro / 1_000_000) * 100) / 100
    }
  };
}
