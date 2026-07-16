import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { RunRoutePoint } from "@/components/coach/types";
import type { WorkoutMatchSource, WorkoutSkipReason } from "@prisma/client";
import {
  computePlanAdherence,
  deriveWorkoutCompletionType,
  pickBestWorkoutMatch,
  EMPTY_ADHERENCE,
  type PlanAdherence,
  type WorkoutStatusValue
} from "@/lib/coach/adherence";
import { buildRunnerCoachContext, type ConversationTurn } from "@/lib/coach/context";
import { resolveRunElevation } from "@/lib/coach/elevation";
import { assessConsistency, assessIntensityDistribution, calculateAveragePaceSecondsPerKm, calculateCoachMetrics, estimateRunCalories, type CoachMetrics } from "@/lib/coach/metrics";
import { generateCoachResponse, parseSleepText, resolveCoachModel, resolveTranscribeModel, transcribeCoachAudio, CoachProviderError, COACH_PROMPT_VERSION } from "@/lib/coach/openai";
import { buildWeeklyPlanSkeleton } from "@/lib/coach/planning";
import { computePersonalRecords, type PersonalRecords } from "@/lib/coach/records";
import { computeBadges, type Badge } from "@/lib/coach/badges";
import { getNutritionCoachSummary } from "@/lib/coach/nutrition";
import { localizeWorkout } from "@/lib/coach/workout-i18n";
import {
  coachInteractionInputSchema,
  createCoachGoalSchema,
  createRunnerRunSchema,
  createSleepLogSchema,
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
import { fetchForecastConditions, fetchRunWeather, resolveCoordinates, type ForecastConditions, type RunWeather } from "@/lib/coach/weather";

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
  weather: unknown;
  isPublic: boolean;
  perceivedEffort: number;
  fatigueLevel: number;
  painLevel: number;
  title: string | null;
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
    // Retire the previous goal's plans too, so their workouts stop driving reminders/rollover once
    // the runner has moved on to a new goal.
    await tx.$executeRaw`
      UPDATE "TrainingPlan"
      SET "status" = 'SUPERSEDED', "updatedAt" = NOW()
      WHERE "userId" = ${userId} AND "status" IN ('ACTIVE', 'DRAFT')
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

// Full edit of an existing goal: the runner can change any onboarding answer (target, times,
// weight/height, training days, injuries, etc.). Sex and birth date are account-level and set once
// at onboarding, so they are intentionally not touched here. Reuses the create schema (sex/date of
// birth are optional there and simply ignored). The metrics snapshot is refreshed since weight
// feeds calorie estimates, and the next generated plan will use the new answers.
export async function updateCoachGoal(userId: string, goalId: string, rawInput: unknown) {
  const input = createCoachGoalSchema.parse(rawInput);
  const prisma = getPrisma();
  await requireOwnedGoal(userId, goalId);

  const chronicConditions = input.chronicConditions ?? [];
  const rows = await prisma.$queryRaw<GoalRow[]>`
    UPDATE "RunnerGoal" SET
      "goalType" = ${input.goalType}::"CoachGoalType",
      "customGoal" = ${input.customGoal ?? null},
      "targetDate" = ${input.targetDate},
      "targetDistanceKm" = ${input.targetDistanceKm ?? null},
      "targetTimeSeconds" = ${input.targetTimeSeconds ?? null},
      "experienceLevel" = ${input.experienceLevel}::"RunnerExperience",
      "currentWeeklyDistanceKm" = ${input.currentWeeklyDistanceKm},
      "yearsRunning" = ${input.yearsRunning ?? null},
      "peakWeeklyDistanceKm" = ${input.peakWeeklyDistanceKm ?? null},
      "longestRecentRunKm" = ${input.longestRecentRunKm ?? null},
      "recentRaceResult" = ${input.recentRaceResult ?? null},
      "restingHeartRate" = ${input.restingHeartRate ?? null},
      "weightKg" = ${input.weightKg ?? null},
      "heightCm" = ${input.heightCm ?? null},
      "availableTrainingDays" = ARRAY[${Prisma.join(input.availableTrainingDays)}]::INTEGER[],
      "preferredLongRunDay" = ${input.preferredLongRunDay ?? null},
      "constraints" = ${input.constraints ?? null},
      "injuryNotes" = ${input.injuryNotes ?? null},
      "injuryHistory" = ${input.injuryHistory ?? null},
      "chronicConditions" = ${chronicConditions.length > 0 ? Prisma.sql`ARRAY[${Prisma.join(chronicConditions)}]::TEXT[]` : Prisma.sql`ARRAY[]::TEXT[]`},
      "healthNotes" = ${input.healthNotes ?? null},
      "preferredLocale" = ${input.preferredLocale},
      "updatedAt" = NOW()
    WHERE "id" = ${goalId} AND "userId" = ${userId}
    RETURNING *
  `;
  if (!rows[0]) throw new CoachError("Goal was not found.", 404, "GOAL_NOT_FOUND");

  await refreshCoachSnapshot(userId, rows[0]);
  return rows[0];
}

// Hard per-user daily cap on Whisper transcriptions. Unlike text chat (gated by the
// interaction entitlement), voice notes had no usage cap — a single paid account could
// issue unlimited billed transcription calls. This bounds the daily cost per user.
const TRANSCRIBE_DAILY_LIMIT = 60;

// Off-topic CHAT refusals are persisted for audit, but they bypass the entitlement/quota gate,
// so cap how many we store per user per day to keep repeated off-topic spam from bloating the table.
const OFF_TOPIC_DAILY_LOG_CAP = 30;

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

  // Resolve the workout link. An explicit workoutId is a runner-picked link (confidence 1); an
  // unlinked run is run through the matcher, which only auto-links a same-day run within a tight
  // distance band and otherwise returns a suggestion for the runner to confirm (Phase 1.3).
  let linkedWorkoutId: string | null = input.workoutId ?? null;
  let matchSource: WorkoutMatchSource | null = input.workoutId ? "EXPLICIT" : null;
  let matchConfidence: number | null = input.workoutId ? 1 : null;
  let linkTargetKm: number | null = null;
  let suggestedMatch: { workoutId: string; title: string; confidence: number } | null = null;

  if (input.workoutId) {
    const workouts = await prisma.$queryRaw<
      Array<{ id: string; completedRunId: string | null; targetDistanceKm: number | null }>
    >`
      SELECT workout."id", workout."targetDistanceKm", completed_run."id" AS "completedRunId"
      FROM "TrainingWorkout" workout
      INNER JOIN "TrainingPlan" plan ON plan."id" = workout."trainingPlanId"
      LEFT JOIN "RunnerRun" completed_run ON completed_run."workoutId" = workout."id"
      WHERE workout."id" = ${input.workoutId} AND plan."userId" = ${userId} AND plan."status" = 'ACTIVE'
      LIMIT 1
    `;
    if (!workouts[0]) throw new CoachError("Training workout was not found.", 404, "WORKOUT_NOT_FOUND");
    if (workouts[0].completedRunId) throw new CoachError("This workout already has a completed run.", 409, "WORKOUT_ALREADY_COMPLETED");
    linkTargetKm = workouts[0].targetDistanceKm;
  } else {
    // Candidate PLANNED, running-type workouts in the active plan within ±1 Algiers day of the run,
    // not already claimed by another run. dayDelta is the whole-day gap between the two local dates.
    const candidates = await prisma.$queryRaw<
      Array<{ id: string; workoutType: string; targetDistanceKm: number | null; title: string; dayDelta: number }>
    >`
      SELECT w."id", w."workoutType"::text AS "workoutType", w."targetDistanceKm", w."title",
        ABS((w."scheduledFor" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Algiers')::date
            - (${input.startedAt}::timestamptz AT TIME ZONE 'Africa/Algiers')::date)::int AS "dayDelta"
      FROM "TrainingWorkout" w
      INNER JOIN "TrainingPlan" p ON p."id" = w."trainingPlanId"
      WHERE p."userId" = ${userId} AND p."status" = 'ACTIVE' AND w."status" = 'PLANNED'
        AND w."workoutType" NOT IN ('REST', 'CROSS_TRAINING')
        AND NOT EXISTS (SELECT 1 FROM "RunnerRun" r WHERE r."workoutId" = w."id")
        AND ABS((w."scheduledFor" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Algiers')::date
            - (${input.startedAt}::timestamptz AT TIME ZONE 'Africa/Algiers')::date) <= 1
    `;
    const best = pickBestWorkoutMatch(
      input.distanceKm,
      candidates.map((c) => ({
        workoutId: c.id,
        workoutType: c.workoutType,
        targetDistanceKm: c.targetDistanceKm,
        dayDelta: Number(c.dayDelta)
      }))
    );
    if (best?.scored.tier === "AUTO") {
      linkedWorkoutId = best.candidate.workoutId;
      matchSource = "AUTO";
      matchConfidence = best.scored.confidence;
      linkTargetKm = best.candidate.targetDistanceKm;
    } else if (best?.scored.tier === "SUGGEST") {
      const cand = candidates.find((c) => c.id === best.candidate.workoutId);
      suggestedMatch = { workoutId: best.candidate.workoutId, title: cand?.title ?? "", confidence: best.scored.confidence };
    }
  }

  const runId = randomUUID();
  // Headline pace is moving-based (excludes stops) when we have a moving time — this is what
  // runners expect and it stays consistent with the per-km splits. Manual runs without a
  // moving time fall back to total duration.
  const paceSeconds = input.movingTimeSeconds && input.movingTimeSeconds > 0 ? input.movingTimeSeconds : input.durationSeconds;
  const pace = calculateAveragePaceSecondsPerKm(input.distanceKm, paceSeconds);

  // Snapshot the weather at the time and place of the run, so post-run feedback can explain pace
  // and effort in context (heat, humidity, wind) instead of reading a slow day as lost fitness.
  // Kicked off here against the raw track (weather only needs the start coordinates, which the
  // elevation pass below doesn't change) so it overlaps elevation resolution instead of adding
  // latency. Best-effort: located from the GPS start or the runner's wilaya, and never allowed to
  // block or fail the save — a null weather column is a fine outcome.
  const weatherPromise = captureRunWeather(userId, { route: input.route ?? null, startedAt: input.startedAt });

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

  const weather = await weatherPromise;
  const weatherJson = weather ? JSON.stringify(weather) : null;

  const routeJson = routePoints && routePoints.length > 0 ? JSON.stringify(routePoints) : null;
  const photosJson = input.photos && input.photos.length > 0 ? JSON.stringify(input.photos) : null;
  const rows = await prisma.$queryRaw<RunRow[]>`
    INSERT INTO "RunnerRun" (
      "id", "userId", "goalId", "workoutId", "workoutMatchSource", "workoutMatchConfidence", "startedAt", "distanceKm", "durationSeconds",
      "averagePaceSecondsPerKm", "movingTimeSeconds", "elevationGainM", "averageHeartRate", "avgCadence",
      "calories", "route", "weather", "isPublic", "perceivedEffort",
      "fatigueLevel", "painLevel", "title", "symptoms", "notes", "photos", "source", "updatedAt"
    ) VALUES (
      ${runId}, ${userId}, ${goal.id}, ${linkedWorkoutId}, ${matchSource ? Prisma.sql`${matchSource}::"WorkoutMatchSource"` : Prisma.sql`NULL`}, ${matchConfidence}, ${input.startedAt}, ${input.distanceKm},
      ${input.durationSeconds}, ${pace}, ${input.movingTimeSeconds ?? null}, ${elevationGainM ?? null}, ${input.averageHeartRate ?? null}, ${input.avgCadence ?? null},
      ${calories}, ${routeJson ? Prisma.sql`CAST(${routeJson} AS JSONB)` : Prisma.sql`NULL`}, ${weatherJson ? Prisma.sql`CAST(${weatherJson} AS JSONB)` : Prisma.sql`NULL`}, ${input.isPublic}, ${input.perceivedEffort},
      ${input.fatigueLevel}, ${input.painLevel}, ${input.title ?? null}, ${input.symptoms ?? null},
      ${input.notes ?? null}, ${photosJson ? Prisma.sql`CAST(${photosJson} AS JSONB)` : Prisma.sql`NULL`}, ${input.source}::"RunnerRunSource", NOW()
    )
    RETURNING *
  `;

  if (linkedWorkoutId) {
    // Record the outcome, not just the status flip. completionConfidence mirrors how the link was
    // made (1 for an explicit/runner link, the matcher's score for an AUTO link); completionType is
    // derived deterministically from distance vs the plan. Any prior skip metadata is cleared so a
    // reopened-then-completed workout doesn't keep a stale skip reason.
    const completionType = deriveWorkoutCompletionType(linkTargetKm, input.distanceKm);
    await prisma.$executeRaw`
      UPDATE "TrainingWorkout" SET
        "status" = 'COMPLETED',
        "completedAt" = ${input.startedAt},
        "completionType" = ${completionType}::"WorkoutCompletionType",
        "completionConfidence" = ${matchConfidence},
        "skippedAt" = NULL,
        "skipReason" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = ${linkedWorkoutId}
    `;
  }

  const metrics = await refreshCoachSnapshot(userId, goal);
  const safety = evaluateCoachSafety(rows[0], metrics, { chronicConditions: goal.chronicConditions });
  // suggestedMatch is non-null only for a medium-confidence unlinked run — the client can offer a
  // one-tap "was this your <title>?" confirm; ignoring it simply leaves the run free.
  return { run: rows[0], metrics, safety, suggestedMatch };
}

// A single run the caller owns, with the fields needed to build a GPX export.
export async function getRunnerRunForExport(userId: string, runId: string) {
  return getPrisma().runnerRun.findFirst({
    where: { id: runId, userId },
    select: { id: true, startedAt: true, title: true, route: true }
  });
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

// Permanently delete a run the caller owns. Any linked coach analysis rows have their runId
// cleared by the schema (SetNull), so past feedback isn't lost. If the run completed a planned
// workout, that workout is reopened so the plan reflects reality.
export async function deleteRun(userId: string, runId: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ id: string; workoutId: string | null; goalId: string | null }>>`
    SELECT "id", "workoutId", "goalId" FROM "RunnerRun" WHERE "id" = ${runId} AND "userId" = ${userId} LIMIT 1
  `;
  const run = rows[0];
  if (!run) throw new CoachError("Run was not found.", 404, "RUN_NOT_FOUND");

  await prisma.$executeRaw`DELETE FROM "RunnerRun" WHERE "id" = ${runId} AND "userId" = ${userId}`;

  if (run.workoutId) {
    // Reopen the workout and clear the completion metadata, so a deleted run leaves no ghost outcome.
    await prisma.$executeRaw`
      UPDATE "TrainingWorkout" SET
        "status" = 'PLANNED',
        "completedAt" = NULL,
        "completionType" = NULL,
        "completionConfidence" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = ${run.workoutId}
    `;
  }
  return { id: run.id };
}

// ---------------------------------------------------------------------------------------------
// Runner workout actions (Phase 1.5) + confirm/reject a match (Phase 1.3). All are ownership- and
// state-validated server-side: a runner can only act on a workout in one of their own ACTIVE plans,
// and can't attach a run to an arbitrary or already-claimed workout.
// ---------------------------------------------------------------------------------------------

type OwnedWorkoutRow = {
  id: string;
  status: string;
  targetDistanceKm: number | null;
  completedRunId: string | null;
  dayDeltaFromRun: number | null;
};

// Confirm a suggested match: attach one of the runner's free runs to a planned workout. Validates
// ownership (both sides), that the workout is still open and unclaimed, and that the run is within a
// day of it — so a client can't bind a run to an unrelated or far-off workout.
export async function confirmWorkoutMatch(userId: string, runId: string, workoutId: string) {
  const prisma = getPrisma();
  const runRows = await prisma.$queryRaw<Array<{ id: string; workoutId: string | null; startedAt: Date; distanceKm: number }>>`
    SELECT "id", "workoutId", "startedAt", "distanceKm" FROM "RunnerRun" WHERE "id" = ${runId} AND "userId" = ${userId} LIMIT 1
  `;
  const run = runRows[0];
  if (!run) throw new CoachError("Run was not found.", 404, "RUN_NOT_FOUND");
  if (run.workoutId) throw new CoachError("This run is already linked to a workout.", 409, "RUN_ALREADY_LINKED");

  const workoutRows = await prisma.$queryRaw<OwnedWorkoutRow[]>`
    SELECT w."id", w."status"::text AS "status", w."targetDistanceKm", completed."id" AS "completedRunId",
      ABS((w."scheduledFor" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Algiers')::date
          - (${run.startedAt}::timestamptz AT TIME ZONE 'Africa/Algiers')::date)::int AS "dayDeltaFromRun"
    FROM "TrainingWorkout" w
    INNER JOIN "TrainingPlan" p ON p."id" = w."trainingPlanId"
    LEFT JOIN "RunnerRun" completed ON completed."workoutId" = w."id"
    WHERE w."id" = ${workoutId} AND p."userId" = ${userId} AND p."status" = 'ACTIVE'
    LIMIT 1
  `;
  const workout = workoutRows[0];
  if (!workout) throw new CoachError("Training workout was not found.", 404, "WORKOUT_NOT_FOUND");
  if (workout.status !== "PLANNED" || workout.completedRunId) {
    throw new CoachError("This workout can no longer be matched.", 409, "WORKOUT_NOT_MATCHABLE");
  }
  if (workout.dayDeltaFromRun === null || workout.dayDeltaFromRun > 1) {
    throw new CoachError("This run is too far from the workout's day to link.", 409, "MATCH_OUT_OF_RANGE");
  }

  const completionType = deriveWorkoutCompletionType(workout.targetDistanceKm, run.distanceKm);
  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "RunnerRun" SET "workoutId" = ${workoutId}, "workoutMatchSource" = 'RUNNER_CONFIRMED'::"WorkoutMatchSource", "workoutMatchConfidence" = 1, "updatedAt" = NOW()
      WHERE "id" = ${runId} AND "userId" = ${userId}
    `,
    prisma.$executeRaw`
      UPDATE "TrainingWorkout" SET "status" = 'COMPLETED', "completedAt" = ${run.startedAt},
        "completionType" = ${completionType}::"WorkoutCompletionType", "completionConfidence" = 1,
        "skippedAt" = NULL, "skipReason" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${workoutId}
    `
  ]);
  return { runId, workoutId };
}

// "Mark as free run": detach a run from its workout (e.g. a wrong auto-match), reopening the workout.
export async function unlinkRunFromWorkout(userId: string, runId: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ id: string; workoutId: string | null }>>`
    SELECT "id", "workoutId" FROM "RunnerRun" WHERE "id" = ${runId} AND "userId" = ${userId} LIMIT 1
  `;
  const run = rows[0];
  if (!run) throw new CoachError("Run was not found.", 404, "RUN_NOT_FOUND");
  if (!run.workoutId) return { runId, workoutId: null };

  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "RunnerRun" SET "workoutId" = NULL, "workoutMatchSource" = NULL, "workoutMatchConfidence" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${runId} AND "userId" = ${userId}
    `,
    prisma.$executeRaw`
      UPDATE "TrainingWorkout" SET "status" = 'PLANNED', "completedAt" = NULL, "completionType" = NULL,
        "completionConfidence" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${run.workoutId}
    `
  ]);
  return { runId, workoutId: run.workoutId };
}

// "I can't do this today": mark a still-planned workout SKIPPED with an optional reason and note.
export async function skipWorkout(
  userId: string,
  workoutId: string,
  reason: WorkoutSkipReason | null,
  note: string | null
) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "TrainingWorkout" w
    SET "status" = 'SKIPPED', "skippedAt" = NOW(),
      "skipReason" = ${reason ? Prisma.sql`${reason}::"WorkoutSkipReason"` : Prisma.sql`NULL`},
      "runnerNote" = ${note?.trim() || null}, "updatedAt" = NOW()
    FROM "TrainingPlan" p
    WHERE w."trainingPlanId" = p."id" AND p."userId" = ${userId} AND p."status" = 'ACTIVE' AND w."status" = 'PLANNED'
      AND w."id" = ${workoutId}
    RETURNING w."id"
  `;
  if (!rows[0]) throw new CoachError("Workout was not found or can no longer be skipped.", 404, "WORKOUT_NOT_SKIPPABLE");
  return { workoutId };
}

// "Move workout": reschedule a still-planned workout to a new day (today or later, within the plan's
// remaining window). Records the move in rescheduledFor.
export async function rescheduleWorkout(userId: string, workoutId: string, scheduledFor: Date) {
  const prisma = getPrisma();
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);
  if (scheduledFor.getTime() < startOfTodayUtc.getTime()) {
    throw new CoachError("Pick today or a future day to move this workout to.", 400, "RESCHEDULE_IN_PAST");
  }
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "TrainingWorkout" w
    SET "scheduledFor" = ${scheduledFor}, "rescheduledFor" = ${scheduledFor}, "updatedAt" = NOW()
    FROM "TrainingPlan" p
    WHERE w."trainingPlanId" = p."id" AND p."userId" = ${userId} AND p."status" = 'ACTIVE' AND w."status" = 'PLANNED'
      AND w."id" = ${workoutId}
      AND ${scheduledFor}::timestamptz <= (p."endsOn" + INTERVAL '1 day')
    RETURNING w."id"
  `;
  if (!rows[0]) throw new CoachError("Workout was not found or can no longer be moved.", 404, "WORKOUT_NOT_RESCHEDULABLE");
  return { workoutId, scheduledFor };
}

// Deterministic plan-adherence summary for the runner's ACTIVE plan (Phase 1.4). Returns a
// hasActivePlan:false zero-summary when there's no active plan, so the free-runner surface degrades
// gracefully instead of reading as 0% adherence.
export async function getPlanAdherence(userId: string): Promise<PlanAdherence> {
  const rows = await getPrisma().$queryRaw<
    Array<{ status: string; workoutType: string; targetDistanceKm: number | null; actualDistanceKm: number | null; scheduledFor: Date }>
  >`
    SELECT w."status"::text AS "status", w."workoutType"::text AS "workoutType",
      w."targetDistanceKm", r."distanceKm" AS "actualDistanceKm", w."scheduledFor"
    FROM "TrainingWorkout" w
    INNER JOIN "TrainingPlan" p ON p."id" = w."trainingPlanId"
    LEFT JOIN "RunnerRun" r ON r."workoutId" = w."id"
    WHERE p."userId" = ${userId} AND p."status" = 'ACTIVE'
  `;
  if (rows.length === 0) return EMPTY_ADHERENCE;
  return computePlanAdherence(
    rows.map((row) => ({
      status: row.status as WorkoutStatusValue,
      workoutType: row.workoutType,
      targetDistanceKm: row.targetDistanceKm,
      actualDistanceKm: row.actualDistanceKm,
      scheduledForMs: new Date(row.scheduledFor).getTime()
    }))
  );
}

export async function getCoachDashboard(userId: string) {
  const prisma = getPrisma();
  // These six reads are independent — run them in parallel so the dashboard is a single
  // round-trip's worth of latency instead of six sequential ones (matters a lot when the
  // app talks to the origin over a high-latency link).
  const [goal, runs, plans, interactions, snapshots, entitlement, sleep, adherence] = await Promise.all([
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
    getCoachEntitlementWithUsage(userId),
    getSleepEntries(userId),
    getPlanAdherence(userId)
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

  return { goal, runs, plans, interactions, snapshot: snapshots[0] ?? null, entitlement, tips, analyzedRuns, sleep, adherence };
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
// Personal records & streaks are derived over the runner's ENTIRE history (not just the
// recent page shown on the Runs screen), so the "best ever" claims stay true as the list scrolls.
export async function getRunnerRecords(userId: string): Promise<PersonalRecords> {
  const runs = await getPrisma().runnerRun.findMany({
    where: { userId },
    select: { id: true, startedAt: true, distanceKm: true, durationSeconds: true, averagePaceSecondsPerKm: true },
    orderBy: { startedAt: "desc" }
  });
  return computePersonalRecords(runs);
}

// The next still-to-do workout from the runner's ACTIVE plan, from today onward. Powers the
// "Start guided workout" affordance on the Runs screen. Only the fields the recorder needs to
// derive a runnable structure are returned.
export type TodayWorkout = {
  id: string;
  workoutType: string;
  title: string;
  targetDistanceKm: number | null;
  targetDurationMin: number | null;
  intensity: string;
  instructions: string;
  scheduledFor: string;
};

export async function getTodayGuidedWorkout(userId: string): Promise<TodayWorkout | null> {
  const rows = await getPrisma().$queryRaw<Array<Omit<TodayWorkout, "scheduledFor"> & { scheduledFor: Date }>>`
    SELECT workout."id", workout."workoutType", workout."title", workout."targetDistanceKm",
           workout."targetDurationMin", workout."intensity", workout."instructions", workout."scheduledFor"
    FROM "TrainingWorkout" workout
    INNER JOIN "TrainingPlan" plan ON plan."id" = workout."trainingPlanId"
    WHERE plan."userId" = ${userId} AND plan."status" = 'ACTIVE' AND workout."status" = 'PLANNED'
      AND workout."scheduledFor" >= date_trunc('day', NOW())
      AND workout."workoutType" NOT IN ('REST', 'CROSS_TRAINING')
    ORDER BY workout."scheduledFor" ASC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { ...row, scheduledFor: row.scheduledFor.toISOString() };
}

// Earned + locked achievement badges for the runner, derived from their records and race finishes.
export async function getRunnerBadges(userId: string, records: PersonalRecords): Promise<Badge[]> {
  const raceFinishes = await getPrisma().raceResult.count({ where: { userId, status: "FINISHED" } });
  return computeBadges({
    totalRuns: records.totalRuns,
    totalDistanceKm: records.totalDistanceKm,
    longestRunKm: records.longestRunKm,
    longestStreakWeeks: records.longestStreakWeeks,
    raceFinishes
  });
}

export async function getRunsScreenData(userId: string, limit = 50) {
  const [runs, goal, records, todayWorkout] = await Promise.all([
    getRunnerRuns(userId, limit),
    getActiveGoal(userId),
    getRunnerRecords(userId),
    getTodayGuidedWorkout(userId)
  ]);
  const [analyzedRuns, badges] = await Promise.all([
    getAnalyzedRunsMap(userId, runs.map((run) => run.id)),
    getRunnerBadges(userId, records)
  ]);
  return { runs, analyzedRuns, weightKg: goal?.weightKg ?? null, records, todayWorkout, badges };
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

  // Off-topic chat is refused before spending the runner's quota or any AI call. Because it skips
  // the entitlement/quota gate, persist these BLOCKED rows only up to a small daily cap per user so
  // repeated off-topic messages can't bloat the CoachInteraction table (bounded above by the
  // per-user route rate limit, but that alone still allows thousands of rows/day).
  if (input.type === "CHAT" && !evaluateTopicality(input.message).onTopic) {
    const response = buildOffTopicCoachResponse(goal.preferredLocale);
    const offTopicSafety = { level: "CLEAR" as const, reasons: [], requiresProfessionalAdvice: false };
    const [logged] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "CoachInteraction"
      WHERE "userId" = ${userId}
        AND "type" = 'CHAT'::"CoachInteractionType"
        AND "status" = 'BLOCKED'
        AND "createdAt" >= NOW() - INTERVAL '1 day'
    `;
    if (Number(logged?.count ?? 0) < OFF_TOPIC_DAILY_LOG_CAP) {
      const offTopicId = randomUUID();
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
    // Over the daily log cap: still refuse gracefully, just don't write another row.
    return { id: randomUUID(), status: "BLOCKED" as const, response, safety: offTopicSafety, plan: null };
  }

  await enforceCoachEntitlement(userId);

  const runs = await getRunsForMetrics(userId);
  const metrics = calculateCoachMetrics(runs);
  const consistency = assessConsistency(runs, goal.availableTrainingDays.length);
  const intensity = assessIntensityDistribution(runs);
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

  const profileRows = await prisma.$queryRaw<Array<{ gender: string | null; dateOfBirth: Date | null; wilaya: string | null; city: string | null }>>`
    SELECT "gender", "dateOfBirth", "wilaya", "city" FROM "User" WHERE "id" = ${userId} LIMIT 1
  `;
  const profile = {
    sex: profileRows[0]?.gender ?? null,
    age: ageFromDateOfBirth(profileRows[0]?.dateOfBirth ?? null)
  };
  const location = profileRows[0]?.wilaya || profileRows[0]?.city
    ? { wilaya: profileRows[0]?.wilaya ?? null, city: profileRows[0]?.city ?? null }
    : null;

  // The linked target race (course, terrain, where/when) enriches every reply. Weather-aware
  // forecast is only worth fetching where it changes advice — planning and open chat — so post-run
  // feedback (which already carries the run's own historical weather) skips the extra round-trip.
  const wantsForecast = input.type !== "POST_RUN";
  const [targetRace, forecast, sleepEntries, nutrition] = await Promise.all([
    getTargetRace(goal.raceEventId),
    wantsForecast ? resolveForecast(runs, profileRows[0]?.wilaya ?? null) : Promise.resolve(null),
    getSleepEntries(userId, 14),
    getNutritionCoachSummary(userId)
  ]);

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
        weather: (selectedRun.weather as RunWeather | null) ?? null,
        route: Array.isArray(selectedRun.route) ? (selectedRun.route as RunRoutePoint[]) : null
      }
    : null;

  // Real adherence on the active plan, so the coach can reference completed/skipped sessions and adapt
  // to misses instead of assuming the plan went perfectly.
  const adherence = await getPlanAdherence(userId);

  const context = buildRunnerCoachContext({
    goal,
    runs,
    metrics,
    skeleton,
    safety,
    interaction: input,
    profile,
    consistency,
    intensity,
    location,
    targetRace,
    forecast,
    sleep: sleepEntries.map((entry) => ({ night: entry.night, durationMinutes: entry.durationMinutes })),
    nutrition,
    targetRun,
    recentConversation,
    adherence
  });

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

// Short, localized summary for an auto-generated (rule-based) weekly plan, so the plan card reads
// naturally and points the runner at the coach if they want changes.
const AUTO_PLAN_SUMMARY: Record<"en" | "fr" | "ar", string> = {
  en: "Your training week, generated automatically to keep you consistent. Ask your coach any time to adjust it.",
  fr: "Votre semaine d'entraînement, générée automatiquement pour vous aider à rester régulier. Demandez à votre coach de l'ajuster.",
  ar: "أسبوعك التدريبي، أُنشئ تلقائيًا لمساعدتك على الحفاظ على انتظامك. اسأل مدربك في أي وقت لتعديله."
};

/**
 * Close missed sessions (Phase 1.2). A PLANNED workout in an ACTIVE plan whose scheduled day is
 * before today — and that has no linked run — is a missed session, so it becomes SKIPPED. This is
 * what lets the coach state real adherence instead of leaving stale PLANNED rows behind.
 *
 * "Today" is evaluated in Africa/Algiers (UTC+1, no DST): Algeria is a single timezone, so we use it
 * as a constant rather than a per-runner field (see the plan's timezone assumption). The date math is
 * done in SQL so it's independent of the server's own timezone — `scheduledFor` is a UTC-naive
 * timestamp, read as UTC then converted to the Algiers calendar date.
 *
 * REST days are never "missed". skipReason stays NULL ("reason unknown") until the runner tells us on
 * their next visit — we never notify or punish here (principle: a missed run triggers a supportive
 * adjustment, not a catch-up block). Idempotent: already-closed workouts aren't touched. Pass a
 * userId to scope it to one runner (used by the rollover, to close the previous plan before the next
 * one is created); omit it for the daily batch across all runners.
 */
export async function closeMissedWorkouts(userId?: string): Promise<{ closed: number }> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "TrainingWorkout" w
    SET "status" = 'SKIPPED', "skippedAt" = NOW(), "updatedAt" = NOW()
    FROM "TrainingPlan" p
    WHERE w."trainingPlanId" = p."id"
      AND p."status" = 'ACTIVE'
      AND w."status" = 'PLANNED'
      AND w."workoutType" <> 'REST'
      AND (w."scheduledFor" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Algiers')::date
          < (NOW() AT TIME ZONE 'Africa/Algiers')::date
      AND NOT EXISTS (SELECT 1 FROM "RunnerRun" r WHERE r."workoutId" = w."id")
      ${userId ? Prisma.sql`AND p."userId" = ${userId}` : Prisma.empty}
    RETURNING w."id"
  `;
  return { closed: rows.length };
}

/**
 * Make sure the runner has an ACTIVE plan whose week includes today. When their active plan's week
 * has ended (and there's no pending draft), generate the next week from the deterministic safety
 * skeleton — starting today — and activate it. No AI call, so it's free and safe to run daily.
 * Returns whether a new plan was created. Leaves a pending DRAFT untouched (the runner may still
 * want to accept their reviewed plan).
 */
export async function ensureCurrentWeekPlan(userId: string): Promise<{ created: boolean }> {
  const goal = await getActiveGoal(userId);
  if (!goal) return { created: false };
  // Don't keep generating weeks once the target race has passed — the goal is effectively done.
  const todayUtcMidnight = new Date();
  todayUtcMidnight.setUTCHours(0, 0, 0, 0);
  if (new Date(goal.targetDate).getTime() < todayUtcMidnight.getTime()) return { created: false };
  const prisma = getPrisma();

  // Close the previous plan's missed sessions before we supersede it and generate the next week, so
  // the plan being retired reflects reality and no past PLANNED workout is orphaned on the old plan.
  await closeMissedWorkouts(userId);

  // Skip when a current-week active plan already covers today, or a draft is awaiting acceptance.
  const existing = await prisma.$queryRaw<Array<{ status: string }>>`
    SELECT "status" FROM "TrainingPlan"
    WHERE "goalId" = ${goal.id}
      AND (("status" = 'ACTIVE' AND "endsOn" >= CURRENT_DATE) OR "status" = 'DRAFT')
    LIMIT 1
  `;
  if (existing[0]) return { created: false };

  const runs = await getRunsForMetrics(userId);
  const metrics = calculateCoachMetrics(runs);
  const skeleton = buildWeeklyPlanSkeleton(goal, metrics);
  if (skeleton.length === 0) return { created: false };

  const locale = goal.preferredLocale === "fr" || goal.preferredLocale === "ar" ? goal.preferredLocale : "en";
  const workouts = skeleton.map((workout) => localizeWorkout(workout, locale));
  const times = workouts.map((workout) => new Date(workout.scheduledFor).getTime());
  const startsOn = new Date(Math.min(...times));
  const endsOn = new Date(Math.max(...times));
  const planId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const versions = await tx.$queryRaw<Array<{ version: number }>>`
      SELECT COALESCE(MAX("version"), 0)::INTEGER AS "version" FROM "TrainingPlan" WHERE "goalId" = ${goal.id}
    `;
    const version = (versions[0]?.version ?? 0) + 1;
    // Retire the ended active plan; a rule-based week is activated immediately (no acceptance step).
    await tx.$executeRaw`
      UPDATE "TrainingPlan" SET "status" = 'SUPERSEDED', "updatedAt" = NOW()
      WHERE "goalId" = ${goal.id} AND "status" = 'ACTIVE'
    `;
    await tx.$executeRaw`
      INSERT INTO "TrainingPlan" (
        "id", "userId", "goalId", "version", "startsOn", "endsOn", "status", "source", "summary", "updatedAt"
      ) VALUES (
        ${planId}, ${userId}, ${goal.id}, ${version}, ${startsOn}, ${endsOn}, 'ACTIVE', 'RULE_BASED', ${AUTO_PLAN_SUMMARY[locale]}, NOW()
      )
    `;
    for (const workout of workouts) {
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
  });
  return { created: true };
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

type SleepRow = {
  id: string;
  night: Date;
  durationMinutes: number;
  bedTime: string | null;
  wakeTime: string | null;
  note: string | null;
  source: "MANUAL" | "PARSED";
  createdAt: Date;
};

// How far back the sleep history goes, for both the runner's own view and the coach context.
const SLEEP_HISTORY_DAYS = 30;
const CLOCK_TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

// Minutes of sleep implied by a bed → wake clock range, wrapping past midnight (the normal case).
function minutesBetweenClockTimes(bed: string, wake: string): number {
  const [bedHour, bedMinute] = bed.split(":").map(Number);
  const [wakeHour, wakeMinute] = wake.split(":").map(Number);
  let minutes = wakeHour * 60 + wakeMinute - (bedHour * 60 + bedMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes;
}

// A JS Date reduced to a UTC "YYYY-MM-DD" string, so the night is stored as a stable calendar date
// regardless of server timezone.
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Log (or replace) a night's sleep. Accepts a duration in hours, a bed/wake clock range, or a
// free-text note in any language that the AI turns into a duration. One row per night (upsert).
// Per-user daily ceiling on billed free-text sleep parses (the manual hours/time fields are free
// and uncapped). Bounds cost even for an entitled account looping the AI parser.
const SLEEP_PARSE_DAILY_LIMIT = 30;

async function enforceSleepParseDailyLimit(userId: string) {
  const model = resolveCoachModel();
  // Sleep parses are the coach-model AiUsageLog rows with no interactionId (coach chats carry one,
  // transcription uses a different model), so this counts only sleep parses.
  const rows = await getPrisma().$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "AiUsageLog"
    WHERE "userId" = ${userId} AND "model" = ${model} AND "interactionId" IS NULL
      AND "createdAt" >= NOW() - INTERVAL '24 hours'
  `;
  if (Number(rows[0]?.count ?? 0) >= SLEEP_PARSE_DAILY_LIMIT) {
    throw new CoachError("Daily sleep-description limit reached. Use the hours or time fields instead.", 429, "SLEEP_PARSE_QUOTA_EXCEEDED");
  }
}

export async function createSleepEntry(userId: string, rawInput: unknown) {
  const input = createSleepLogSchema.parse(rawInput);
  const prisma = getPrisma();

  let durationMinutes: number;
  let bedTime = input.bedTime ?? null;
  let wakeTime = input.wakeTime ?? null;
  let source: "MANUAL" | "PARSED" = "MANUAL";

  if (input.durationHours !== null && input.durationHours !== undefined) {
    durationMinutes = Math.round(input.durationHours * 60);
  } else if (input.bedTime && input.wakeTime) {
    durationMinutes = minutesBetweenClockTimes(input.bedTime, input.wakeTime);
  } else if (input.text) {
    // The free-text path calls the LLM, so it costs money: gate it exactly like a coach chat
    // (blocks NONE-tier / over-limit users) and add a per-user daily cap on parses.
    await enforceCoachEntitlement(userId);
    await enforceSleepParseDailyLimit(userId);

    const parsed = await parseSleepText(input.text);
    // Track the billed parse call next to other AI usage, WITH token counts so the admin cost
    // dashboard doesn't undercount sleep-parse spend. Sleep parses carry no interactionId, which is
    // how they're told apart from coach interactions on the coach model.
    await prisma.$executeRaw`
      INSERT INTO "AiUsageLog" (
        "id", "userId", "model", "status", "inputTokens", "cachedInputTokens", "outputTokens",
        "reasoningTokens", "estimatedCostMicroUsd"
      ) VALUES (
        ${randomUUID()}, ${userId}, ${parsed.model}, 'SUCCEEDED', ${parsed.usage.inputTokens},
        ${parsed.usage.cachedInputTokens}, ${parsed.usage.outputTokens}, ${parsed.usage.reasoningTokens},
        ${parsed.usage.estimatedCostMicroUsd}
      )
    `;
    if (!parsed.result.understood || parsed.result.durationMinutes <= 0) {
      throw new CoachError(
        "Could not understand that. Try e.g. \"slept about 7 hours\" or use the time fields.",
        422,
        "SLEEP_PARSE_FAILED"
      );
    }
    durationMinutes = parsed.result.durationMinutes;
    bedTime = parsed.result.bedTime && CLOCK_TIME_PATTERN.test(parsed.result.bedTime) ? parsed.result.bedTime : null;
    wakeTime = parsed.result.wakeTime && CLOCK_TIME_PATTERN.test(parsed.result.wakeTime) ? parsed.result.wakeTime : null;
    source = "PARSED";
  } else {
    throw new CoachError("Provide sleep hours, bed and wake times, or a description.", 400, "SLEEP_INPUT_REQUIRED");
  }

  durationMinutes = Math.max(1, Math.min(24 * 60, durationMinutes));
  const night = toDateOnly(input.night ?? new Date());

  const rows = await prisma.$queryRaw<SleepRow[]>`
    INSERT INTO "SleepLog" (
      "id", "userId", "night", "durationMinutes", "bedTime", "wakeTime", "note", "source", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${userId}, ${night}::date, ${durationMinutes}, ${bedTime}, ${wakeTime},
      ${input.note ?? null}, ${source}::"SleepLogSource", NOW()
    )
    ON CONFLICT ("userId", "night") DO UPDATE SET
      "durationMinutes" = EXCLUDED."durationMinutes",
      "bedTime" = EXCLUDED."bedTime",
      "wakeTime" = EXCLUDED."wakeTime",
      "note" = EXCLUDED."note",
      "source" = EXCLUDED."source",
      "updatedAt" = NOW()
    RETURNING "id", "night", "durationMinutes", "bedTime", "wakeTime", "note", "source", "createdAt"
  `;
  return rows[0];
}

export async function getSleepEntries(userId: string, days = SLEEP_HISTORY_DAYS): Promise<SleepRow[]> {
  const safeDays = Math.min(90, Math.max(1, days));
  return getPrisma().$queryRaw<SleepRow[]>`
    SELECT "id", "night", "durationMinutes", "bedTime", "wakeTime", "note", "source", "createdAt"
    FROM "SleepLog"
    WHERE "userId" = ${userId} AND "night" >= (CURRENT_DATE - ${safeDays}::int)
    ORDER BY "night" DESC
    LIMIT 90
  `;
}

// Best-effort weather snapshot for a run. Prefers the GPS start point and only looks up the
// runner's wilaya when there is no track (manual entry). Never throws — a null result just means
// the run is stored without weather.
async function captureRunWeather(
  userId: string,
  run: { route: RunRoutePoint[] | null; startedAt: Date }
): Promise<RunWeather | null> {
  try {
    const wilaya = run.route?.length ? null : await getUserWilaya(userId);
    const coordinates = resolveCoordinates({ route: run.route, wilaya });
    if (!coordinates) return null;
    return await fetchRunWeather({ coordinates, at: new Date(run.startedAt) });
  } catch {
    return null;
  }
}

async function getUserWilaya(userId: string): Promise<string | null> {
  const rows = await getPrisma().$queryRaw<Array<{ wilaya: string | null }>>`
    SELECT "wilaya" FROM "User" WHERE "id" = ${userId} LIMIT 1
  `;
  return rows[0]?.wilaya ?? null;
}

// The target race a goal is training toward, when one is linked. Surfaces the actual course and
// location (elevation, terrain notes, where and when) so the coach can tailor prep, not just echo
// the goal's copied date/distance. Never throws — coaching proceeds without it.
type TargetRaceContext = {
  title: string;
  raceType: string;
  startDate: Date;
  wilaya: string;
  city: string;
  elevationGainText: string | null;
  conditions: string | null;
  latitude: number | null;
  longitude: number | null;
};

async function getTargetRace(raceEventId: string | null): Promise<TargetRaceContext | null> {
  if (!raceEventId) return null;
  try {
    const rows = await getPrisma().$queryRaw<TargetRaceContext[]>`
      SELECT "title", "raceType"::text AS "raceType", "startDate", "wilaya", "city",
             "elevationGainText", "conditions", "latitude", "longitude"
      FROM "RaceEvent"
      WHERE "id" = ${raceEventId} AND "status" = 'PUBLISHED'
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// Current + today's forecast for where the runner trains, so planning and daily chat can adapt to
// heat, humidity and rain. Prefers the location of a recent GPS run, else the runner's wilaya.
// Best-effort: null when weather is off, no location resolves, or the provider is slow.
async function resolveForecast(
  runs: RunRow[],
  wilaya: string | null
): Promise<ForecastConditions | null> {
  try {
    const recentRoute = runs.find((run) => Array.isArray(run.route) && (run.route as unknown[]).length > 0);
    const coordinates = resolveCoordinates({
      route: (recentRoute?.route as RunRoutePoint[] | undefined) ?? null,
      wilaya
    });
    if (!coordinates) return null;
    return await fetchForecastConditions(coordinates);
  } catch {
    return null;
  }
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
