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
    return apiOk(request, { hasPlan: false, weekStart: null, workouts: [] });
  }

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
      weekStart: Date;
    }>
  >`
    WITH bounds AS (
      SELECT date_trunc('week', (NOW() AT TIME ZONE 'Africa/Algiers')) AS week_start
    )
    SELECT workout."id", workout."title", workout."workoutType"::text AS "workoutType",
           workout."status"::text AS "status", workout."intensity"::text AS "intensity",
           workout."instructions", workout."targetDistanceKm", workout."targetDurationMin",
           workout."scheduledFor", bounds.week_start AS "weekStart"
    FROM "TrainingWorkout" workout
    INNER JOIN "TrainingPlan" plan ON plan."id" = workout."trainingPlanId"
    CROSS JOIN bounds
    WHERE plan."userId" = ${viewer.id} AND plan."status" = 'ACTIVE'
      AND (workout."scheduledFor" AT TIME ZONE 'Africa/Algiers') >= bounds.week_start
      AND (workout."scheduledFor" AT TIME ZONE 'Africa/Algiers') < bounds.week_start + interval '7 days'
    ORDER BY workout."scheduledFor" ASC
  `;

  return apiOk(request, {
    hasPlan: rows.length > 0,
    weekStart: rows[0]?.weekStart.toISOString() ?? null,
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
    })),
  });
});
