import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getPrisma } from "@/lib/db";
import { getCoachEntitlementWithUsage } from "@/lib/coach/entitlement";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * This week's workouts from the active plan.
 *
 * Bounded to the current Mon–Sun window rather than returning the whole plan: the screen draws one
 * week, and a marathon block is 16+ weeks of workouts the phone would download and discard.
 *
 * The week is computed in Africa/Algiers, not UTC and not the device's clock — a runner opening the
 * app late on Sunday evening should see the week they just finished, not tomorrow's.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-plan", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const entitlement = await getCoachEntitlementWithUsage(viewer.id);
  if (entitlement.tier === "NONE") {
    // Same reasoning as the overview: not subscribed is a state to render, not an error to retry.
    return apiOk(request, { hasPlan: false, weekStart: null, planStartsOn: null, planEndsOn: null, workouts: [] });
  }

  /**
   * Whether a plan exists at all, asked separately from what falls inside this week.
   *
   * Deriving `hasPlan` from the week's row count conflated two different answers: a runner with no
   * plan, and a runner who has just finished setup on a Saturday and whose plan starts on Monday.
   * The second was being told "no plan yet" moments after creating one — and offered the setup flow
   * they had just completed.
   */
  const activePlans = await getPrisma().$queryRaw<Array<{ startsOn: Date; endsOn: Date }>>`
    SELECT "startsOn", "endsOn" FROM "TrainingPlan"
    WHERE "userId" = ${viewer.id} AND "status" = 'ACTIVE'
    ORDER BY "startsOn" DESC
    LIMIT 1
  `;
  const activePlan = activePlans[0] ?? null;

  const rows = await getPrisma().$queryRaw<
    Array<{
      id: string;
      title: string;
      workoutType: string;
      status: string;
      intensity: string;
      instructions: string;
      targetDistanceKm: number | null;
      targetDurationMin: number | null;
      scheduledFor: Date;
      skipReason: string | null;
      runnerNote: string | null;
      planEndsOn: Date;
      weekStart: Date;
    }>
  /*
   * scheduledFor is timestamp *without* time zone (Prisma's default mapping), holding UTC.
   *
   * The obvious-looking "scheduledFor AT TIME ZONE 'Africa/Algiers'" is therefore the wrong
   * operator: on a naive timestamp that expression *attaches* a zone and yields a timestamptz,
   * which is then compared against a naive bound through the session zone. The window came out
   * shifted by Algiers' offset, so the first workout of the *following* Monday (00:00 UTC) was
   * returned as part of this week — and the client, drawing seven day cells from the week start it
   * was also given, had nowhere to put it and crashed.
   *
   * So convert the *bounds* instead: build them in Algiers wall-clock, resolve each to a real
   * instant, then express it back as UTC so both sides of the comparison mean the same thing.
   */
  >`
    WITH bounds AS (
      SELECT
        (date_trunc('week', (NOW() AT TIME ZONE 'Africa/Algiers')) AT TIME ZONE 'Africa/Algiers') AT TIME ZONE 'UTC' AS week_start,
        ((date_trunc('week', (NOW() AT TIME ZONE 'Africa/Algiers')) + interval '7 days') AT TIME ZONE 'Africa/Algiers') AT TIME ZONE 'UTC' AS week_end
    )
    SELECT workout."id", workout."title", workout."workoutType"::text AS "workoutType",
           workout."status"::text AS "status", workout."intensity"::text AS "intensity",
           workout."instructions", workout."targetDistanceKm", workout."targetDurationMin",
           workout."scheduledFor", workout."skipReason"::text AS "skipReason", workout."runnerNote",
           plan."endsOn" AS "planEndsOn", bounds.week_start AS "weekStart"
    FROM "TrainingWorkout" workout
    INNER JOIN "TrainingPlan" plan ON plan."id" = workout."trainingPlanId"
    CROSS JOIN bounds
    WHERE plan."userId" = ${viewer.id} AND plan."status" = 'ACTIVE'
      AND workout."scheduledFor" >= bounds.week_start
      AND workout."scheduledFor" < bounds.week_end
    ORDER BY workout."scheduledFor" ASC
  `;

  return apiOk(request, {
    hasPlan: activePlan !== null,
    weekStart: rows[0]?.weekStart.toISOString() ?? null,
    // When the plan begins, so a client can say "your plan starts Monday" rather than implying the
    // week is empty because nothing was planned.
    planStartsOn: activePlan?.startsOn.toISOString() ?? null,
    // The last day a workout may be moved to. The client needs it to build a day picker that
    // cannot offer a date the server would refuse.
    planEndsOn: activePlan?.endsOn.toISOString() ?? null,
    workouts: rows.map((row) => ({
      id: row.id,
      title: row.title,
      workoutType: row.workoutType,
      status: row.status,
      intensity: row.intensity,
      instructions: row.instructions,
      targetDistanceKm: row.targetDistanceKm,
      targetDurationMin: row.targetDurationMin,
      scheduledFor: row.scheduledFor.toISOString(),
      // Why a session was missed, so the plan can say it plainly instead of leaving a silent gap.
      skipReason: row.skipReason,
      runnerNote: row.runnerNote,
    })),
  });
});
