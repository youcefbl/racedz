import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { coachErrorToApiError } from "@/lib/api/v1/coach";
import { CoachError } from "@/lib/coach/errors";
import { confirmWorkoutMatch, unlinkRunFromWorkout } from "@/lib/coach/service";
import { readJsonBody } from "@/lib/api/v1/http";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const confirmSchema = z.object({ workoutId: z.string().min(1).max(64) });

/**
 * Confirm that this run was the planned workout — the mobile twin of the website's
 * /api/coach/runs/[id]/match.
 *
 * Both verbs delegate to the same service functions the website calls, so the ownership checks, the
 * "workout already claimed" and "too far from its day" refusals, the non-foot exclusion, and the
 * transactional workout status update are shared rather than reimplemented. A second implementation
 * here would eventually disagree with the website about whether a session counted, which is the
 * kind of difference that quietly corrupts plan adherence.
 *
 * Why this exists at all: the matcher already runs on every save and already stores a *suggestion*,
 * but the suggestion only ever appeared in the create response. The phone had no way to act on it
 * and no way to undo a wrong auto-link, so adherence on mobile silently depended on the matcher
 * being right (NATGAP-07).
 */
export const POST = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { id } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-run-match", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Try again shortly."));

  const parsed = confirmSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "A workout id is required.");

  try {
    return apiOk(request, await confirmWorkoutMatch(viewer.id, id, parsed.data.workoutId));
  } catch (error) {
    if (error instanceof CoachError) throw coachErrorToApiError(error);
    throw error;
  }
});

/**
 * "It was a free run": detach the run from its workout, reopening the workout as PLANNED.
 *
 * Succeeds on an already-unlinked run rather than erroring — a client retrying an undo it never saw
 * acknowledged should not be punished for reaching the state it asked for.
 */
export const DELETE = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { id } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-run-match", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Try again shortly."));

  try {
    return apiOk(request, await unlinkRunFromWorkout(viewer.id, id));
  } catch (error) {
    if (error instanceof CoachError) throw coachErrorToApiError(error);
    throw error;
  }
});
