import { getPrisma } from "@/lib/db";

// The runner's actual active plan, workout by workout, for the AI context (context-hardening work).
// The adherence *summary* tells the coach "4 of 6 done"; this tells it exactly WHICH sessions happened —
// so it can say "you nailed the tempo but skipped Tuesday's easy run for fatigue" instead of guessing.
// The deterministic skeleton stays authoritative for safety; this is read-only reality.

export type ActivePlanContextWorkout = {
  date: string; // scheduled calendar date (YYYY-MM-DD)
  type: string; // CoachWorkoutType
  targetDistanceKm: number | null;
  status: string; // PLANNED | COMPLETED | SKIPPED | CANCELLED
  completionType: string | null; // AS_PLANNED | PARTIAL | … when completed
  skipReason: string | null; // when skipped, if known
  actualDistanceKm: number | null; // from the linked run
};

export type ActivePlanContext = {
  version: number;
  startsOn: string;
  endsOn: string;
  status: string;
  workouts: ActivePlanContextWorkout[];
};

type Row = {
  version: number;
  startsOn: Date;
  endsOn: Date;
  status: string;
  scheduledFor: Date;
  workoutType: string;
  targetDistanceKm: number | null;
  wstatus: string;
  completionType: string | null;
  skipReason: string | null;
  actualDistanceKm: number | null;
};

export async function getActivePlanForContext(userId: string): Promise<ActivePlanContext | null> {
  const rows = await getPrisma().$queryRaw<Row[]>`
    SELECT p."version", p."startsOn", p."endsOn", p."status"::text AS "status",
      w."scheduledFor", w."workoutType"::text AS "workoutType", w."targetDistanceKm",
      w."status"::text AS "wstatus", w."completionType"::text AS "completionType",
      w."skipReason"::text AS "skipReason", r."distanceKm" AS "actualDistanceKm"
    FROM "TrainingPlan" p
    INNER JOIN "TrainingWorkout" w ON w."trainingPlanId" = p."id"
    LEFT JOIN "RunnerRun" r ON r."workoutId" = w."id"
    WHERE p."userId" = ${userId} AND p."status" = 'ACTIVE'
    ORDER BY w."scheduledFor" ASC
  `;
  if (rows.length === 0) return null;

  const first = rows[0];
  return {
    version: first.version,
    startsOn: first.startsOn.toISOString().slice(0, 10),
    endsOn: first.endsOn.toISOString().slice(0, 10),
    status: first.status,
    workouts: rows.map((row) => ({
      date: row.scheduledFor.toISOString().slice(0, 10),
      type: row.workoutType,
      targetDistanceKm: row.targetDistanceKm,
      status: row.wstatus,
      completionType: row.completionType,
      skipReason: row.skipReason,
      actualDistanceKm: row.actualDistanceKm
    }))
  };
}
