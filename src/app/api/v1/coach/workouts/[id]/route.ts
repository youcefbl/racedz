import { z } from "zod";
import { apiError, apiOk, ApiError, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { CoachError } from "@/lib/coach/errors";
import { rescheduleWorkout, setWorkoutSkipReason, skipWorkout } from "@/lib/coach/service";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * The runner's exception actions on a planned workout — the mobile twin of
 * `/api/coach/workouts/[id]`, calling the same three helpers so "I can't today" and "Move" mean
 * exactly the same thing on both clients and the plan cannot drift between them.
 *
 * Ownership is enforced inside those helpers: each is a single UPDATE joined to the runner's own
 * ACTIVE plan, so another runner's workout id simply matches no row and 404s. There is deliberately
 * no read-then-write here that could be raced.
 */
const SKIP_REASONS = [
  "SCHEDULE",
  "FATIGUE",
  "PAIN_OR_SYMPTOMS",
  "WEATHER",
  "ILLNESS",
  "TRAVEL",
  "MOTIVATION",
  "OTHER",
] as const;

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("skip"),
    reason: z.enum(SKIP_REASONS).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({
    action: z.literal("reschedule"),
    scheduledFor: z.string().datetime(),
  }),
  z.object({
    action: z.literal("reason"),
    reason: z.enum(SKIP_REASONS),
    note: z.string().trim().max(500).nullable().optional(),
  }),
]);

export const PATCH = withApi(async (request, context: { params: Promise<{ id: string }> }) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-workout", viewer.id), 60, 5 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many changes. Try again shortly."));

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "That change is not one this workout accepts.");
  const body = parsed.data;

  try {
    const data =
      body.action === "skip"
        ? await skipWorkout(viewer.id, id, body.reason ?? null, body.note ?? null)
        : body.action === "reason"
          ? await setWorkoutSkipReason(viewer.id, id, body.reason, body.note ?? null)
          : await rescheduleWorkout(viewer.id, id, new Date(body.scheduledFor));
    return apiOk(request, data);
  } catch (error) {
    if (error instanceof CoachError) {
      // A workout that is not the caller's, or is no longer in a state that accepts the change,
      // are the same answer on purpose — the second must not confirm the first exists.
      throw new ApiError(error.status === 404 ? "NOT_FOUND" : "VALIDATION_FAILED", error.message);
    }
    throw error;
  }
});
