import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getPrisma } from "@/lib/db";
import { getCoachEntitlementWithUsage } from "@/lib/coach/entitlement";
import { getPlanAdherence, getTodayGuidedWorkout } from "@/lib/coach/service";
import { productDayEnd } from "@/lib/coach/calendar";
import { coachReplySummary } from "@/lib/api/v1/coach";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * The Coach overview: entitlement, the active goal, today's and the next workout, this week's
 * adherence, and the latest coach review.
 *
 * Deliberately NOT getCoachDashboard(): that returns ten runs, two full plans with every workout,
 * ten interactions, sleep history, and tips — megabytes the phone would download to render six
 * cards. This reuses the same underlying helpers but returns only what the screen draws.
 *
 * Entitlement is included even when the tier is NONE, and the endpoint still answers 200. The app
 * needs to know it should show the subscribe prompt rather than an error, and a 402 here would be
 * indistinguishable from a failure to the client's retry logic.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const prisma = getPrisma();
  const entitlement = await getCoachEntitlementWithUsage(viewer.id);

  // Without an entitlement there is nothing to load, and loading it anyway would leak the shape of
  // a paid feature to someone who has not paid for it.
  if (entitlement.tier === "NONE") {
    return apiOk(request, { entitlement, goal: null, todayWorkout: null, nextWorkout: null, adherence: null, latestReview: null });
  }

  const [goal, todayWorkout, adherence] = await Promise.all([
    prisma.runnerGoal.findFirst({
      where: { userId: viewer.id, status: "ACTIVE" },
      select: { id: true, goalType: true, targetDate: true, targetDistanceKm: true, customGoal: true },
    }),
    getTodayGuidedWorkout(viewer.id),
    getPlanAdherence(viewer.id),
  ]);

  // The next PLANNED session AFTER today, so the card can say what is coming without pulling the
  // whole plan down.
  //
  // `> date_trunc('day', NOW())` looked right but matched anything later than midnight *today*, so a
  // runner whose session was scheduled for this morning saw the very same workout as both "Today's
  // workout" and "Next workout" (DEV-R05). Starting at tomorrow's midnight is what "next" means to
  // a runner reading the two cards side by side.
  //
  // That midnight is the *Algiers* one. `date_trunc('day', NOW())` is the UTC day, so for the first
  // hour of every local day this bound sat a day behind and could offer today's session as "next" —
  // the same off-by-one-day that getTodayGuidedWorkout carried on the other side of the pair. Both
  // now read the boundary from the one definition in `@/lib/coach/calendar`.
  const upcoming = await prisma.$queryRaw<
    Array<{ id: string; title: string; targetDistanceKm: number | null; targetDurationMin: number | null; scheduledFor: Date }>
  >`
    SELECT workout."id", workout."title", workout."targetDistanceKm", workout."targetDurationMin", workout."scheduledFor"
    FROM "TrainingWorkout" workout
    INNER JOIN "TrainingPlan" plan ON plan."id" = workout."trainingPlanId"
    WHERE plan."userId" = ${viewer.id} AND plan."status" = 'ACTIVE' AND workout."status" = 'PLANNED'
      AND workout."workoutType" NOT IN ('REST', 'CROSS_TRAINING')
      AND workout."scheduledFor" >= ${productDayEnd}
    ORDER BY workout."scheduledFor" ASC
    LIMIT 1
  `;

  // The most recent completed coach reply. PENDING and FAILED are excluded so the card never shows
  // a half-written or errored response as if it were advice.
  const reviews = await prisma.$queryRaw<Array<{ response: string | null; createdAt: Date }>>`
    SELECT "response", "createdAt" FROM "CoachInteraction"
    WHERE "userId" = ${viewer.id} AND "status" = 'COMPLETED' AND "response" IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;

  return apiOk(request, {
    entitlement,
    goal: goal && {
      id: goal.id,
      goalType: goal.goalType,
      targetDate: goal.targetDate?.toISOString() ?? null,
      targetDistanceKm: goal.targetDistanceKm,
      customGoal: goal.customGoal,
    },
    todayWorkout,
    nextWorkout: upcoming[0]
      ? {
          id: upcoming[0].id,
          title: upcoming[0].title,
          targetDistanceKm: upcoming[0].targetDistanceKm,
          targetDurationMin: upcoming[0].targetDurationMin,
          scheduledFor: upcoming[0].scheduledFor.toISOString(),
        }
      : null,
    adherence: adherence.hasActivePlan
      ? {
          plannedSessions: adherence.plannedSessions,
          completedSessions: adherence.completedSessions,
          remainingSessions: adherence.remainingSessions,
          completionRate: adherence.completionRate,
        }
      : null,
    // The stored reply is a structured object; the card wants one line of it. Handing the whole
    // object through as `text` broke the client's contract (string) and errored the entire Coach
    // tab for any runner who had ever asked a question.
    latestReview: reviews[0]
      ? { text: coachReplySummary(reviews[0].response), createdAt: reviews[0].createdAt.toISOString() }
      : null,
  });
});
