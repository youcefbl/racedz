import { coachErrorToApiError } from "@/lib/api/v1/coach";
import { apiError, apiOk, ApiError, withApi, readJsonBody } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { createCoachGoal, ensureCurrentWeekPlan, getCoachProfileGaps, updateCoachGoal } from "@/lib/coach/service";
import { CoachError } from "@/lib/coach/errors";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * What the onboarding form still needs to ask for.
 *
 * Sex and birth date live on the User record and are only asked for when they are missing —
 * re-asking a runner for something they already gave the website is how a form feels careless.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-goals", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const [gaps, active] = await Promise.all([
    getCoachProfileGaps(viewer.id),
    // The whole editable answer set, not just whether one exists: editing a goal means showing the
    // runner what they said last time, and a form that opens blank is a form that quietly discards
    // the health context and availability they already gave.
    getPrisma().runnerGoal.findFirst({
      where: { userId: viewer.id, status: "ACTIVE" },
      select: {
        id: true, goalType: true, customGoal: true, targetDate: true, targetDistanceKm: true,
        targetTimeSeconds: true, experienceLevel: true, currentWeeklyDistanceKm: true,
        yearsRunning: true, peakWeeklyDistanceKm: true, longestRecentRunKm: true, recentRaceResult: true,
        restingHeartRate: true, weightKg: true, heightCm: true, availableTrainingDays: true,
        preferredLongRunDay: true, constraints: true, injuryNotes: true, injuryHistory: true,
        chronicConditions: true, healthNotes: true, preferredLocale: true,
      },
    }),
  ]);

  return apiOk(request, {
    needsSex: gaps.sex,
    needsBirthDate: gaps.birthDate,
    hasActiveGoal: Boolean(active),
    goal: active && {
      ...active,
      targetDate: active.targetDate.toISOString(),
    },
  });
});

/**
 * Edits the active goal in place.
 *
 * `updateCoachGoal` deliberately does *not* supersede the training plan the way creating a new goal
 * does — which is the whole point of having an edit at all. Changing the coach's language, moving a
 * target date, or adding an injury should adjust what comes next, not throw away the week the runner
 * is in the middle of.
 */
export const PATCH = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-goal-update", viewer.id), 20, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many changes. Try again shortly."));

  const active = await getPrisma().runnerGoal.findFirst({
    where: { userId: viewer.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!active) throw new ApiError("NOT_FOUND", "There is no active goal to edit.");

  try {
    const goal = await updateCoachGoal(viewer.id, active.id, await readJsonBody(request), "native");
    return apiOk(request, { goal });
  } catch (error) {
    if (error instanceof CoachError) {
      throw coachErrorToApiError(error);
    }
    if (error instanceof Error && error.name === "ZodError") {
      // Field names would be safe to log, but the values here are injury and health history.
      console.warn("[api/v1][coach-goal] update rejected");
      throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields.");
    }
    throw error;
  }
});

/**
 * Create the coaching goal, which is what lets the coach build a plan.
 *
 * Reuses createCoachGoal() — the same call the website's setup form makes — so the validation, the
 * profile write-back, and the plan generation that follows are identical. Notably it also writes sex
 * and birth date back to the User record, which is why the app collects them here rather than
 * inventing a separate profile step.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-goal-create", viewer.id), 10, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many attempts. Try again shortly."));

  try {
    const goal = await createCoachGoal(viewer.id, await readJsonBody(request), "native");

    // createCoachGoal() stores the goal but does not build a plan — on the website a nightly job
    // (coach/reminders.ts) calls this. Without it the app finishes onboarding and lands on an empty
    // "No plan yet" dashboard, which reads as the setup having silently failed. Generate the first
    // week here so completing onboarding produces something.
    //
    // Best-effort: the goal is saved either way, and a plan that fails to generate now will be
    // picked up by the same nightly job. Failing the whole request would throw away the answers the
    // runner just gave.
    const plan = await ensureCurrentWeekPlan(viewer.id).catch((error) => {
      console.error("[api/v1][coach-goal] first-week plan generation failed:", error);
      return { created: false };
    });

    return apiOk(request, { goal, planCreated: plan.created }, { status: 201 });
  } catch (error) {
    if (error instanceof CoachError) {
      throw coachErrorToApiError(error);
    }
    // A schema miss from the shared parser. The field names are safe to log; the values are the
    // runner's health and injury history and are not.
    if (error instanceof Error && error.name === "ZodError") {
      console.warn("[api/v1][coach-goal] rejected");
      throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields.");
    }
    throw error;
  }
});
