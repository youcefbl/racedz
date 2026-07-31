import { apiError, apiOk, ApiError, withApi, readJsonBody } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { createCoachGoal, getCoachProfileGaps } from "@/lib/coach/service";
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
    getPrisma().runnerGoal.findFirst({
      where: { userId: viewer.id, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  return apiOk(request, { needsSex: gaps.sex, needsBirthDate: gaps.birthDate, hasActiveGoal: Boolean(active) });
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
    const goal = await createCoachGoal(viewer.id, await readJsonBody(request));
    return apiOk(request, goal, { status: 201 });
  } catch (error) {
    if (error instanceof CoachError) {
      const code = error.status === 404 ? "NOT_FOUND" : error.status === 409 ? "CONFLICT" : "VALIDATION_FAILED";
      throw new ApiError(code, error.message);
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
