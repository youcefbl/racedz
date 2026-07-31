import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getTodayGuidedWorkout } from "@/lib/coach/service";
import { buildWorkoutStructure, flattenStructure, targetMeters, targetSeconds } from "@/lib/coach/workout-structure";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * The guided session to run right now: a warm-up, the work, and a cool-down, as an ordered list of
 * steps the app can count through and speak.
 *
 * Built with buildWorkoutStructure/flattenStructure — the same helpers the website's guided runs
 * use, covered by test:workout — so a guided session is identical on both clients.
 *
 * When the runner has no active plan there is still a session: an easy steady run bookended by a
 * warm-up and cool-down. Guided running is not a Coach feature here (recording a run does not
 * require a goal either), and a runner who taps "Guided" should get guidance, not an upsell.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-guided", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const planned = await getTodayGuidedWorkout(viewer.id);

  const structure = planned
    ? buildWorkoutStructure({
        workoutType: planned.workoutType,
        targetDistanceKm: planned.targetDistanceKm,
        targetDurationMin: planned.targetDurationMin,
      })
    : null;

  // The default when there is no plan (or the planned workout is not runnable): 10 minutes easy,
  // 20 steady, 10 easy. Deliberately conservative — this is what someone gets when nobody has
  // prescribed anything, so it should suit an unknown runner on an unknown day.
  const resolved = structure ?? {
    blocks: [
      { kind: "single" as const, step: { role: "WARMUP" as const, intensity: "EASY" as const, target: { type: "TIME" as const, seconds: 600 } } },
      { kind: "single" as const, step: { role: "STEADY" as const, intensity: "EASY" as const, target: { type: "TIME" as const, seconds: 1200 } } },
      { kind: "single" as const, step: { role: "COOLDOWN" as const, intensity: "EASY" as const, target: { type: "TIME" as const, seconds: 600 } } },
    ],
  };

  const steps = flattenStructure(resolved).map((step) => ({
    index: step.index,
    total: step.total,
    role: step.role,
    intensity: step.intensity,
    // Exactly one of these is set; the app counts down whichever it gets.
    seconds: targetSeconds(step.target),
    meters: targetMeters(step.target),
    repCurrent: step.rep?.current ?? null,
    repTotal: step.rep?.total ?? null,
  }));

  return apiOk(request, {
    // Null when this is the generic session rather than something the runner's plan prescribed —
    // the app says "Guided run" instead of naming a workout nobody scheduled.
    workoutId: structure ? planned?.id ?? null : null,
    title: structure ? planned?.title ?? null : null,
    fromPlan: Boolean(structure),
    steps,
  });
});
