import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { RunRoutePoint } from "@/components/coach/types";
import { buildRunnerCoachContext, type ConversationTurn } from "@/lib/coach/context";
import { resolveRunElevation } from "@/lib/coach/elevation";
import { calculateAveragePaceSecondsPerKm, calculateCoachMetrics, estimateRunCalories, type CoachMetrics } from "@/lib/coach/metrics";
import { generateCoachResponse, resolveTranscribeModel, transcribeCoachAudio, CoachProviderError, COACH_PROMPT_VERSION } from "@/lib/coach/openai";
import { buildWeeklyPlanSkeleton } from "@/lib/coach/planning";
import {
  coachInteractionInputSchema,
  createCoachGoalSchema,
  createRunnerRunSchema,
  updateCoachGoalSettingsSchema,
  updateCoachGoalStatusSchema,
  type CoachInteractionInput,
  type CoachResponse,
  type CreateCoachGoalInput
} from "@/lib/coach/schemas";
import { buildBlockedCoachResponse, enforceCoachSafety, evaluateCoachSafety } from "@/lib/coach/safety";
import { CoachError } from "@/lib/coach/errors";
import { enforceCoachEntitlement, getCoachEntitlementWithUsage } from "@/lib/coach/entitlement";
import { getTipsForProfile } from "@/lib/coach/tips";
import { buildOffTopicCoachResponse, evaluateTopicality } from "@/lib/coach/topicality";

export { CoachError };

type GoalRow = {
  id: string;
  userId: string;
  raceEventId: string | null;
  goalType: CreateCoachGoalInput["goalType"];
  customGoal: string | null;
  targetDate: Date;
  targetDistanceKm: number | null;
  targetTimeSeconds: number | null;
  experienceLevel: CreateCoachGoalInput["experienceLevel"];
  currentWeeklyDistanceKm: number;
  yearsRunning: number | null;
  peakWeeklyDistanceKm: number | null;
  longestRecentRunKm: number | null;
  recentRaceResult: string | null;
  restingHeartRate: number | null;
  weightKg: number | null;
  heightCm: number | null;
  availableTrainingDays: number[];
  preferredLongRunDay: number | null;
  constraints: string | null;
  injuryNotes: string | null;
  injuryHistory: string | null;
  chronicConditions: string[];
  healthNotes: string | null;
  preferredLocale: "en" | "fr" | "ar";
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  createdAt: Date;
  updatedAt: Date;
};

type RunRow = {
  id: string;
  userId: string;
  goalId: string | null;
  workoutId: string | null;
  startedAt: Date;
  distanceKm: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number;
  movingTimeSeconds: number | null;
  elevationGainM: number | null;
  averageHeartRate: number | null;
  avgCadence: number | null;
  calories: number | null;
  route: unknown;
  isPublic: boolean;
  perceivedEffort: number;
  fatigueLevel: number;
  painLevel: number;
  symptoms: string | null;
  notes: string | null;
  photos: unknown;
  source: "MANUAL" | "IMPORTED" | "GPS";
  createdAt: Date;
  updatedAt: Date;
};

type InteractionRow = {
  id: string;
  type: CoachInteractionInput["type"];
  runId: string | null;
  status: "PENDING" | "COMPLETED" | "BLOCKED" | "FAILED";
  userMessage: string | null;
  response: CoachResponse | null;
  safety: unknown;
  model: string | null;
  errorCode: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export async function createCoachGoal(userId: string, rawInput: unknown) {
  const input = createCoachGoalSchema.parse(rawInput);
  const prisma = getPrisma();

  if (input.raceEventId) {
    const race = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "RaceEvent"
      WHERE "id" = ${input.raceEventId} AND "status" = 'PUBLISHED'
      LIMIT 1
    `;
    if (!race[0]) throw new CoachError("Target race was not found.", 404, "TARGET_RACE_NOT_FOUND");
  }

  const goalId = randomUUID();
  const goal = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "RunnerGoal"
      SET "status" = 'PAUSED', "updatedAt" = NOW()
      WHERE "userId" = ${userId} AND "status" = 'ACTIVE'
    `;

    const chronicConditions = input.chronicConditions ?? [];
    const rows = await tx.$queryRaw<GoalRow[]>`
      INSERT INTO "RunnerGoal" (
        "id", "userId", "raceEventId", "goalType", "customGoal", "targetDate",
        "targetDistanceKm", "targetTimeSeconds", "experienceLevel", "currentWeeklyDistanceKm",
        "yearsRunning", "peakWeeklyDistanceKm", "longestRecentRunKm", "recentRaceResult", "restingHeartRate", "weightKg", "heightCm",
        "availableTrainingDays", "preferredLongRunDay", "constraints", "injuryNotes",
        "injuryHistory", "chronicConditions", "healthNotes",
        "preferredLocale", "status", "updatedAt"
      ) VALUES (
        ${goalId}, ${userId}, ${input.raceEventId ?? null}, ${input.goalType}::"CoachGoalType",
        ${input.customGoal ?? null}, ${input.targetDate}, ${input.targetDistanceKm ?? null},
        ${input.targetTimeSeconds ?? null}, ${input.experienceLevel}::"RunnerExperience",
        ${input.currentWeeklyDistanceKm}, ${input.yearsRunning ?? null}, ${input.peakWeeklyDistanceKm ?? null},
        ${input.longestRecentRunKm ?? null}, ${input.recentRaceResult ?? null}, ${input.restingHeartRate ?? null}, ${input.weightKg ?? null}, ${input.heightCm ?? null},
        ARRAY[${Prisma.join(input.availableTrainingDays)}]::INTEGER[],
        ${input.preferredLongRunDay ?? null}, ${input.constraints ?? null}, ${input.injuryNotes ?? null},
        ${input.injuryHistory ?? null},
        ${chronicConditions.length > 0 ? Prisma.sql`ARRAY[${Prisma.join(chronicConditions)}]::TEXT[]` : Prisma.sql`ARRAY[]::TEXT[]`},
        ${input.healthNotes ?? null},
        ${input.preferredLocale}, 'ACTIVE', NOW()
      )
      RETURNING *
    `;

    // Backfill the account profile with sex / birth date collected during onboarding, but only
    // where the user hasn't already set them — never overwrite existing profile data.
    if (input.sex || input.dateOfBirth) {
      await tx.$executeRaw`
        UPDATE "User"
        SET "gender" = COALESCE("gender", ${input.sex ?? null}::"Gender"),
            "dateOfBirth" = COALESCE("dateOfBirth", ${input.dateOfBirth ?? null}),
            "updatedAt" = NOW()
        WHERE "id" = ${userId}
      `;
    }

    return rows[0];
  });

  await refreshCoachSnapshot(userId, goal);
  return goal;
}

// Whole years between the runner's birth date and today; null when the birth date is unknown.
function ageFromDateOfBirth(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

// Which critical profile fields the runner hasn't set yet, so onboarding can ask for them.
// These drive plan personalisation (training load, recovery, calorie estimates).
export async function getCoachProfileGaps(userId: string) {
  const rows = await getPrisma().$queryRaw<Array<{ gender: string | null; dateOfBirth: Date | null }>>`
    SELECT "gender", "dateOfBirth" FROM "User" WHERE "id" = ${userId} LIMIT 1
  `;
  const user = rows[0];
  return { sex: !user?.gender, birthDate: !user?.dateOfBirth };
}

export async function getCoachGoals(userId: string) {
  return getPrisma().$queryRaw<GoalRow[]>`
    SELECT * FROM "RunnerGoal"
    WHERE "userId" = ${userId}
    ORDER BY CASE WHEN "status" = 'ACTIVE' THEN 0 ELSE 1 END, "updatedAt" DESC
  `;
}

export async function updateCoachGoalStatus(userId: string, goalId: string, rawInput: unknown) {
  const { status } = updateCoachGoalStatusSchema.parse(rawInput);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    if (status === "ACTIVE") {
      await tx.$executeRaw`
        UPDATE "RunnerGoal" SET "status" = 'PAUSED', "updatedAt" = NOW()
        WHERE "userId" = ${userId} AND "status" = 'ACTIVE' AND "id" <> ${goalId}
      `;
    }

    const rows = await tx.$queryRaw<GoalRow[]>`
      UPDATE "RunnerGoal"
      SET "status" = ${status}::"CoachGoalStatus", "updatedAt" = NOW()
      WHERE "id" = ${goalId} AND "userId" = ${userId}
      RETURNING *
    `;
    if (!rows[0]) throw new CoachError("Goal was not found.", 404, "GOAL_NOT_FOUND");
    return rows[0];
  });
}

export async function updateCoachGoalSettings(userId: string, goalId: string, rawInput: unknown) {
  const { preferredLocale } = updateCoachGoalSettingsSchema.parse(rawInput);

  const rows = await getPrisma().$queryRaw<GoalRow[]>`
    UPDATE "RunnerGoal"
    SET "preferredLocale" = ${preferredLocale}, "updatedAt" = NOW()
    WHERE "id" = ${goalId} AND "userId" = ${userId}
    RETURNING *
  `;
  if (!rows[0]) throw new CoachError("Goal was not found.", 404, "GOAL_NOT_FOUND");
  return rows[0];
}

// Hard per-user daily cap on Whisper transcriptions. Unlike text chat (gated by the
// interaction entitlement), voice notes had no usage cap — a single paid account could
// issue unlimited billed transcription calls. This bounds the daily cost per user.
const TRANSCRIBE_DAILY_LIMIT = 60;

// Transcribe a voice note and record the OpenAI call in AiUsageLog (success and failure alike),
// so audio failures are tracked next to text failures on the admin dashboard.
export async function transcribeCoachVoiceNote(userId: string, file: File): Promise<string> {
  const prisma = getPrisma();
  const model = resolveTranscribeModel();

  const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "AiUsageLog"
    WHERE "userId" = ${userId}
      AND "model" = ${model}
      AND "createdAt" >= NOW() - INTERVAL '24 hours'
  `;
  if (Number(count) >= TRANSCRIBE_DAILY_LIMIT) {
    throw new CoachError("Daily voice-note limit reached. Try again tomorrow.", 429, "TRANSCRIBE_QUOTA_EXCEEDED");
  }

  try {
    const transcript = await transcribeCoachAudio(file);
    await prisma.$executeRaw`
      INSERT INTO "AiUsageLog" ("id", "userId", "model", "status")
      VALUES (${randomUUID()}, ${userId}, ${model}, 'SUCCEEDED')
    `;
    return transcript;
  } catch (error) {
    const code = error instanceof CoachError ? error.code : "OPENAI_TRANSCRIBE_FAILED";
    await prisma.$executeRaw`
      INSERT INTO "AiUsageLog" ("id", "userId", "model", "status", "errorCode", "errorMessage")
      VALUES (${randomUUID()}, ${userId}, ${model}, 'FAILED', ${code}, ${errorMessageFor(error)})
    `;
    throw error;
  }
}

// Keep a readable, length-capped detail for the admin error log. Falls back to a provided
// default when the thrown value has no usable message.
function errorMessageFor(error: unknown, fallback = "Unknown error.") {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  return (raw || fallback).slice(0, 500);
}

export async function createRunnerRun(userId: string, rawInput: unknown) {
  const input = createRunnerRunSchema.parse(rawInput);
  const prisma = getPrisma();
  const goal = input.goalId ? await requireOwnedGoal(userId, input.goalId) : await getActiveGoal(userId);

  if (!goal) throw new CoachError("Create an active coaching goal before logging a coached run.", 409, "ACTIVE_GOAL_REQUIRED");

  if (input.workoutId) {
    const workouts = await prisma.$queryRaw<Array<{ id: string; completedRunId: string | null }>>`
      SELECT workout."id", completed_run."id" AS "completedRunId"
      FROM "TrainingWorkout" workout
      INNER JOIN "TrainingPlan" plan ON plan."id" = workout."trainingPlanId"
      LEFT JOIN "RunnerRun" completed_run ON completed_run."workoutId" = workout."id"
      WHERE workout."id" = ${input.workoutId} AND plan."userId" = ${userId}
      LIMIT 1
    `;
    if (!workouts[0]) throw new CoachError("Training workout was not found.", 404, "WORKOUT_NOT_FOUND");
    if (workouts[0].completedRunId) throw new CoachError("This workout already has a completed run.", 409, "WORKOUT_ALREADY_COMPLETED");
  }

  const runId = randomUUID();
  // Headline pace is moving-based (excludes stops) when we have a moving time — this is what
  // runners expect and it stays consistent with the per-km splits. Manual runs without a
  // moving time fall back to total duration.
  const paceSeconds = input.movingTimeSeconds && input.movingTimeSeconds > 0 ? input.movingTimeSeconds : input.durationSeconds;
  const pace = calculateAveragePaceSecondsPerKm(input.distanceKm, paceSeconds);

  // Recompute elevation gain server-side from the GPS track (terrain-corrected when a DEM is
  // configured, smoothed otherwise). Raw phone-GPS altitude over-counts climb badly, so the
  // client-reported gain is treated as advisory only. Manual runs keep their reported value.
  let routePoints = input.route ?? null;
  let elevationGainM = input.elevationGainM ?? null;
  if (routePoints && routePoints.length > 1) {
    const resolved = await resolveRunElevation(routePoints);
    routePoints = resolved.route;
    elevationGainM = resolved.gainM;
  }

  const calories =
    input.calories ??
    estimateRunCalories({
      weightKg: input.weightKg ?? goal.weightKg,
      distanceKm: input.distanceKm,
      elevationGainM
    });
  const routeJson = routePoints && routePoints.length > 0 ? JSON.stringify(routePoints) : null;
  const photosJson = input.photos && input.photos.length > 0 ? JSON.stringify(input.photos) : null;
  const rows = await prisma.$queryRaw<RunRow[]>`
    INSERT INTO "RunnerRun" (
      "id", "userId", "goalId", "workoutId", "startedAt", "distanceKm", "durationSeconds",
      "averagePaceSecondsPerKm", "movingTimeSeconds", "elevationGainM", "averageHeartRate", "avgCadence",
      "calories", "route", "isPublic", "perceivedEffort",
      "fatigueLevel", "painLevel", "symptoms", "notes", "photos", "source", "updatedAt"
    ) VALUES (
      ${runId}, ${userId}, ${goal.id}, ${input.workoutId ?? null}, ${input.startedAt}, ${input.distanceKm},
      ${input.durationSeconds}, ${pace}, ${input.movingTimeSeconds ?? null}, ${elevationGainM ?? null}, ${input.averageHeartRate ?? null}, ${input.avgCadence ?? null},
      ${calories}, ${routeJson ? Prisma.sql`CAST(${routeJson} AS JSONB)` : Prisma.sql`NULL`}, ${input.isPublic}, ${input.perceivedEffort},
      ${input.fatigueLevel}, ${input.painLevel}, ${input.symptoms ?? null},
      ${input.notes ?? null}, ${photosJson ? Prisma.sql`CAST(${photosJson} AS JSONB)` : Prisma.sql`NULL`}, ${input.source}::"RunnerRunSource", NOW()
    )
    RETURNING *
  `;

  if (input.workoutId) {
    await prisma.$executeRaw`
      UPDATE "TrainingWorkout" SET "status" = 'COMPLETED', "updatedAt" = NOW()
      WHERE "id" = ${input.workoutId}
    `;
  }

  const metrics = await refreshCoachSnapshot(userId, goal);
  const safety = evaluateCoachSafety(rows[0], metrics, { chronicConditions: goal.chronicConditions });
  return { run: rows[0], metrics, safety };
}

export async function getRunnerRuns(userId: string, limit = 50) {
  const safeLimit = Math.min(100, Math.max(1, limit));
  return getPrisma().$queryRaw<RunRow[]>`
    SELECT * FROM "RunnerRun"
    WHERE "userId" = ${userId}
    ORDER BY "startedAt" DESC
    LIMIT ${safeLimit}
  `;
}

// Partial update of a run the caller owns: visibility and/or photos. Each field is only
// touched when provided, so flipping visibility never clears photos and vice versa.
export async function updateRun(
  userId: string,
  runId: string,
  fields: { isPublic?: boolean; photos?: string[] }
) {
  const setPhotos = fields.photos !== undefined;
  const photosJson = setPhotos ? JSON.stringify(fields.photos) : null;
  const rows = await getPrisma().$queryRaw<RunRow[]>`
    UPDATE "RunnerRun" SET
      "isPublic" = COALESCE(${fields.isPublic ?? null}, "isPublic"),
      "photos" = CASE WHEN ${setPhotos} THEN CAST(${photosJson} AS JSONB) ELSE "photos" END,
      "updatedAt" = NOW()
    WHERE "id" = ${runId} AND "userId" = ${userId}
    RETURNING *
  `;
  if (!rows[0]) throw new CoachError("Run was not found.", 404, "RUN_NOT_FOUND");
  return rows[0];
}

export async function getCoachDashboard(userId: string) {
  const prisma = getPrisma();
  // These six reads are independent — run them in parallel so the dashboard is a single
  // round-trip's worth of latency instead of six sequential ones (matters a lot when the
  // app talks to the origin over a high-latency link).
  const [goal, runs, plans, interactions, snapshots, entitlement] = await Promise.all([
    getActiveGoal(userId),
    getRunnerRuns(userId, 10),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT plan.*,
        COALESCE(
          jsonb_agg(to_jsonb(workout) ORDER BY workout."scheduledFor") FILTER (WHERE workout."id" IS NOT NULL),
          '[]'::jsonb
        ) AS workouts
      FROM "TrainingPlan" plan
      LEFT JOIN "TrainingWorkout" workout ON workout."trainingPlanId" = plan."id"
      WHERE plan."userId" = ${userId} AND plan."status" IN ('ACTIVE', 'DRAFT')
      GROUP BY plan."id"
      ORDER BY CASE WHEN plan."status" = 'ACTIVE' THEN 0 ELSE 1 END, plan."version" DESC
      LIMIT 2
    `,
    prisma.$queryRaw<InteractionRow[]>`
      SELECT "id", "type", "runId", "status", "userMessage", "response", "safety", "model", "errorCode", "createdAt", "completedAt"
      FROM "CoachInteraction"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ metrics: CoachMetrics; generatedAt: Date }>>`
      SELECT "metrics", "generatedAt" FROM "CoachSnapshot" WHERE "userId" = ${userId} LIMIT 1
    `,
    getCoachEntitlementWithUsage(userId)
  ]);

  // Tip categories depend on the resolved goal, so this runs after the parallel reads.
  // It's a single small indexed query; localized to the runner's preferred language.
  const preferred = goal?.preferredLocale;
  const locale = preferred === "fr" || preferred === "ar" ? preferred : "en";
  const tips = (await getTipsForProfile(goal, locale)).map((tip) => tip.text);

  // Map each shown run to its latest non-failed POST_RUN analysis, independent of the
  // 10-interaction window above. Without this, an already-analyzed run whose analysis
  // scrolled out of the recent list wrongly shows "Analyze run" again and re-analyzing
  // burns another AI credit.
  const analyzedRuns = await getAnalyzedRunsMap(userId, runs.map((run) => run.id));

  return { goal, runs, plans, interactions, snapshot: snapshots[0] ?? null, entitlement, tips, analyzedRuns };
}

// runId → id of its latest non-failed POST_RUN analysis, for the given runs. Shared by the coach
// dashboard and the standalone Runs screen so both show "Coach analysis" on already-analyzed runs.
export async function getAnalyzedRunsMap(userId: string, runIds: string[]): Promise<Record<string, string>> {
  if (runIds.length === 0) return {};
  const rows = await getPrisma().$queryRaw<Array<{ runId: string; id: string }>>`
    SELECT DISTINCT ON ("runId") "runId", "id"
    FROM "CoachInteraction"
    WHERE "userId" = ${userId} AND "type" = 'POST_RUN' AND "status" <> 'FAILED'
      AND "runId" IN (${Prisma.join(runIds)})
    ORDER BY "runId", "createdAt" DESC
  `;
  const map: Record<string, string> = {};
  for (const row of rows) map[row.runId] = row.id;
  return map;
}

// Everything the standalone Runs screen needs to reach parity with the coach's Runs tab:
// the runs, their existing-analysis map (for the "Coach analysis" button), and the runner's
// weight (for the live calorie estimate in the recorder).
export async function getRunsScreenData(userId: string, limit = 50) {
  const [runs, goal] = await Promise.all([getRunnerRuns(userId, limit), getActiveGoal(userId)]);
  const analyzedRuns = await getAnalyzedRunsMap(userId, runs.map((run) => run.id));
  return { runs, analyzedRuns, weightKg: goal?.weightKg ?? null };
}

export async function createCoachInteraction(userId: string, rawInput: unknown) {
  const input = coachInteractionInputSchema.parse(rawInput);
  const prisma = getPrisma();
  const goal = await getActiveGoal(userId);
  if (!goal) throw new CoachError("An active coaching goal is required.", 409, "ACTIVE_GOAL_REQUIRED");

  const selectedRun = input.runId ? await requireOwnedRun(userId, input.runId) : null;
  if (selectedRun?.goalId && selectedRun.goalId !== goal.id) {
    throw new CoachError("The selected run does not belong to the active goal.", 409, "RUN_GOAL_MISMATCH");
  }

  // Off-topic chat is refused before spending the runner's quota or any AI call.
  if (input.type === "CHAT" && !evaluateTopicality(input.message).onTopic) {
    const offTopicId = randomUUID();
    const response = buildOffTopicCoachResponse(goal.preferredLocale);
    const offTopicSafety = { level: "CLEAR" as const, reasons: [], requiresProfessionalAdvice: false };
    await prisma.$executeRaw`
      INSERT INTO "CoachInteraction" (
        "id", "userId", "goalId", "runId", "type", "status", "userMessage", "response", "safety", "promptVersion", "completedAt"
      ) VALUES (
        ${offTopicId}, ${userId}, ${goal.id}, ${null}, 'CHAT'::"CoachInteractionType",
        'BLOCKED', ${input.message ?? null}, CAST(${JSON.stringify(response)} AS JSONB),
        CAST(${JSON.stringify(offTopicSafety)} AS JSONB), ${COACH_PROMPT_VERSION}, NOW()
      )
    `;
    return { id: offTopicId, status: "BLOCKED" as const, response, safety: offTopicSafety, plan: null };
  }

  await enforceCoachEntitlement(userId);

  const runs = await getRunsForMetrics(userId);
  const metrics = calculateCoachMetrics(runs);
  const safetyRun = selectedRun ?? runs[0] ?? null;
  const safety = evaluateCoachSafety(
    safetyRun
      ? { ...safetyRun, symptoms: `${safetyRun.symptoms ?? ""} ${goal.injuryNotes ?? ""}`.trim() || null }
      : { painLevel: 0, fatigueLevel: 0, symptoms: goal.injuryNotes, notes: null },
    metrics,
    { chronicConditions: goal.chronicConditions }
  );
  const skeleton = buildWeeklyPlanSkeleton(goal, metrics);
  const interactionId = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "CoachInteraction" (
      "id", "userId", "goalId", "runId", "type", "status", "userMessage", "safety", "promptVersion"
    ) VALUES (
      ${interactionId}, ${userId}, ${goal.id}, ${selectedRun?.id ?? null}, ${input.type}::"CoachInteractionType",
      'PENDING', ${input.message ?? null}, CAST(${JSON.stringify(safety)} AS JSONB), ${COACH_PROMPT_VERSION}
    )
  `;

  if (safety.level === "BLOCKED") {
    const response = buildBlockedCoachResponse(safety, goal.preferredLocale);
    await prisma.$executeRaw`
      UPDATE "CoachInteraction"
      SET "status" = 'BLOCKED', "response" = CAST(${JSON.stringify(response)} AS JSONB), "completedAt" = NOW()
      WHERE "id" = ${interactionId}
    `;
    return { id: interactionId, status: "BLOCKED" as const, response, safety, plan: null };
  }

  const profileRows = await prisma.$queryRaw<Array<{ gender: string | null; dateOfBirth: Date | null }>>`
    SELECT "gender", "dateOfBirth" FROM "User" WHERE "id" = ${userId} LIMIT 1
  `;
  const profile = {
    sex: profileRows[0]?.gender ?? null,
    age: ageFromDateOfBirth(profileRows[0]?.dateOfBirth ?? null)
  };

  // Recent exchanges (this runner only) so the coach can build on what was already asked and
  // advised instead of repeating itself. The just-inserted PENDING row is excluded by status.
  const historyRows = await prisma.$queryRaw<Array<Pick<InteractionRow, "type" | "userMessage" | "response" | "createdAt">>>`
    SELECT "type", "userMessage", "response", "createdAt"
    FROM "CoachInteraction"
    WHERE "userId" = ${userId} AND "id" <> ${interactionId}
      AND "status" IN ('COMPLETED', 'BLOCKED') AND "response" IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 6
  `;
  const recentConversation: ConversationTurn[] = historyRows
    .reverse()
    .map((row) => ({
      type: row.type,
      at: row.createdAt,
      runnerQuestion: row.userMessage,
      coachSummary: row.response?.summary ?? null
    }));

  // For post-run feedback, hand the coach the exact run under review (with per-km splits) so the
  // reply is centred on that effort rather than inferred from the recent-runs list.
  const targetRun = selectedRun
    ? {
        id: selectedRun.id,
        startedAt: selectedRun.startedAt,
        distanceKm: selectedRun.distanceKm,
        durationSeconds: selectedRun.durationSeconds,
        averagePaceSecondsPerKm: selectedRun.averagePaceSecondsPerKm,
        movingTimeSeconds: selectedRun.movingTimeSeconds,
        elevationGainM: selectedRun.elevationGainM,
        averageHeartRate: selectedRun.averageHeartRate,
        avgCadence: selectedRun.avgCadence,
        calories: selectedRun.calories,
        perceivedEffort: selectedRun.perceivedEffort,
        fatigueLevel: selectedRun.fatigueLevel,
        painLevel: selectedRun.painLevel,
        symptoms: selectedRun.symptoms,
        notes: selectedRun.notes,
        route: Array.isArray(selectedRun.route) ? (selectedRun.route as RunRoutePoint[]) : null
      }
    : null;

  const context = buildRunnerCoachContext({ goal, runs, metrics, skeleton, safety, interaction: input, profile, targetRun, recentConversation });

  try {
    const generated = await generateCoachResponse(context, interactionId);
    const response = enforceCoachSafety(generated.response, safety, skeleton, goal.preferredLocale);
    const plan = input.type === "INITIAL_PLAN" || input.type === "WEEKLY_REVIEW"
      ? await saveDraftPlan(userId, goal.id, response)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "CoachInteraction"
        SET "status" = 'COMPLETED', "response" = CAST(${JSON.stringify(response)} AS JSONB),
            "model" = ${generated.model}, "completedAt" = NOW()
        WHERE "id" = ${interactionId}
      `;
      await tx.$executeRaw`
        INSERT INTO "AiUsageLog" (
          "id", "userId", "interactionId", "providerResponseId", "model", "status",
          "inputTokens", "cachedInputTokens", "outputTokens", "reasoningTokens", "estimatedCostMicroUsd"
        ) VALUES (
          ${randomUUID()}, ${userId}, ${interactionId}, ${generated.providerResponseId}, ${generated.model}, 'SUCCEEDED',
          ${generated.usage.inputTokens}, ${generated.usage.cachedInputTokens}, ${generated.usage.outputTokens},
          ${generated.usage.reasoningTokens}, ${generated.usage.estimatedCostMicroUsd}
        )
      `;
    });

    return { id: interactionId, status: "COMPLETED" as const, response, safety, plan };
  } catch (error) {
    const providerError = error instanceof CoachProviderError
      ? error
      : new CoachProviderError("AI coaching is temporarily unavailable.", "COACH_GENERATION_FAILED", process.env.OPENAI_COACH_MODEL ?? "gpt-5.4-mini");

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "CoachInteraction"
        SET "status" = 'FAILED', "model" = ${providerError.model}, "errorCode" = ${providerError.code}, "completedAt" = NOW()
        WHERE "id" = ${interactionId}
      `;
      await tx.$executeRaw`
        INSERT INTO "AiUsageLog" ("id", "userId", "interactionId", "model", "status", "errorCode", "errorMessage")
        VALUES (
          ${randomUUID()}, ${userId}, ${interactionId}, ${providerError.model}, 'FAILED',
          ${providerError.code}, ${errorMessageFor(error, providerError.message)}
        )
      `;
    });

    throw new CoachError(providerError.message, 503, providerError.code);
  }
}

export async function updateTrainingPlanStatus(userId: string, planId: string, status: "ACTIVE" | "CANCELLED") {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    if (status === "ACTIVE") {
      await tx.$executeRaw`
        UPDATE "TrainingPlan" SET "status" = 'SUPERSEDED', "updatedAt" = NOW()
        WHERE "userId" = ${userId} AND "status" = 'ACTIVE' AND "id" <> ${planId}
      `;
    }
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      UPDATE "TrainingPlan" SET "status" = ${status}::"TrainingPlanStatus", "updatedAt" = NOW()
      WHERE "id" = ${planId} AND "userId" = ${userId} AND "status" IN ('DRAFT', 'ACTIVE')
      RETURNING *
    `;
    if (!rows[0]) throw new CoachError("Training plan was not found or cannot be changed.", 404, "PLAN_NOT_FOUND");
    return rows[0];
  });
}

async function saveDraftPlan(userId: string, goalId: string, response: CoachResponse) {
  if (response.upcomingWorkouts.length === 0) return null;
  const prisma = getPrisma();
  const dates = response.upcomingWorkouts.map((workout) => new Date(workout.scheduledFor));
  const startsOn = new Date(Math.min(...dates.map((date) => date.getTime())));
  const endsOn = new Date(Math.max(...dates.map((date) => date.getTime())));
  const planId = randomUUID();

  return prisma.$transaction(async (tx) => {
    const versions = await tx.$queryRaw<Array<{ version: number }>>`
      SELECT COALESCE(MAX("version"), 0)::INTEGER AS "version" FROM "TrainingPlan" WHERE "goalId" = ${goalId}
    `;
    const version = (versions[0]?.version ?? 0) + 1;
    await tx.$executeRaw`
      UPDATE "TrainingPlan" SET "status" = 'SUPERSEDED', "updatedAt" = NOW()
      WHERE "goalId" = ${goalId} AND "status" = 'DRAFT'
    `;
    await tx.$executeRaw`
      INSERT INTO "TrainingPlan" (
        "id", "userId", "goalId", "version", "startsOn", "endsOn", "status", "source", "summary", "updatedAt"
      ) VALUES (
        ${planId}, ${userId}, ${goalId}, ${version}, ${startsOn}, ${endsOn}, 'DRAFT', 'AI_ASSISTED', ${response.summary}, NOW()
      )
    `;
    for (const workout of response.upcomingWorkouts) {
      await tx.$executeRaw`
        INSERT INTO "TrainingWorkout" (
          "id", "trainingPlanId", "scheduledFor", "workoutType", "title", "targetDistanceKm",
          "targetDurationMin", "intensity", "instructions", "status", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${planId}, ${new Date(workout.scheduledFor)}, ${workout.workoutType}::"CoachWorkoutType",
          ${workout.title}, ${workout.targetDistanceKm}, ${workout.targetDurationMin}, ${workout.intensity},
          ${workout.instructions}, 'PLANNED', NOW()
        )
      `;
    }
    return { id: planId, version, status: "DRAFT" as const, startsOn, endsOn, workouts: response.upcomingWorkouts };
  });
}

async function getActiveGoal(userId: string) {
  const rows = await getPrisma().$queryRaw<GoalRow[]>`
    SELECT * FROM "RunnerGoal" WHERE "userId" = ${userId} AND "status" = 'ACTIVE' ORDER BY "updatedAt" DESC LIMIT 1
  `;
  return rows[0] ?? null;
}

async function requireOwnedGoal(userId: string, goalId: string) {
  const rows = await getPrisma().$queryRaw<GoalRow[]>`
    SELECT * FROM "RunnerGoal" WHERE "id" = ${goalId} AND "userId" = ${userId} LIMIT 1
  `;
  if (!rows[0]) throw new CoachError("Goal was not found.", 404, "GOAL_NOT_FOUND");
  return rows[0];
}

async function requireOwnedRun(userId: string, runId: string) {
  const rows = await getPrisma().$queryRaw<RunRow[]>`
    SELECT * FROM "RunnerRun" WHERE "id" = ${runId} AND "userId" = ${userId} LIMIT 1
  `;
  if (!rows[0]) throw new CoachError("Run was not found.", 404, "RUN_NOT_FOUND");
  return rows[0];
}

async function getRunsForMetrics(userId: string) {
  return getPrisma().$queryRaw<RunRow[]>`
    SELECT * FROM "RunnerRun"
    WHERE "userId" = ${userId} AND "startedAt" >= NOW() - INTERVAL '56 days'
    ORDER BY "startedAt" DESC
    LIMIT 120
  `;
}

async function refreshCoachSnapshot(userId: string, goal: GoalRow) {
  const prisma = getPrisma();
  const runs = await getRunsForMetrics(userId);
  const metrics = calculateCoachMetrics(runs);
  await prisma.$executeRaw`
    INSERT INTO "CoachSnapshot" ("id", "userId", "goalId", "metrics", "generatedAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${goal.id}, CAST(${JSON.stringify(metrics)} AS JSONB), NOW(), NOW())
    ON CONFLICT ("userId") DO UPDATE SET
      "goalId" = EXCLUDED."goalId", "metrics" = EXCLUDED."metrics", "generatedAt" = NOW(), "updatedAt" = NOW()
  `;
  return metrics;
}

