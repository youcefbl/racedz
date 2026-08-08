import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import {
  GUIDED_SESSION_TEMPLATES,
  buildGuidedSession,
  flattenStructure,
  targetMeters,
  targetSeconds,
} from "@/lib/coach/workout-structure";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Steps for a workout the runner picked themselves — intervals, the Norwegian 4x4, strides, a
 * recovery jog, or a long run — with no plan or goal involved. This is what lets the native app offer
 * a free-run "workout type" chooser that speaks its warm-up, work reps, recovery and cool-down.
 *
 * It reuses the exact same GUIDED_SESSION_TEMPLATES the website's picker uses (buildGuidedSession),
 * and serialises the flattened steps identically to /runs/guided, so the app deserialises one
 * GuidedSessionDto shape whether the session came from a plan or from a chosen type. Any template
 * parameter (reps, repMeters, workMinutes, easyMinutes, durationMin, distanceKm) may be passed as a
 * query value and is clamped to the template's declared bounds server-side.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-structure", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const url = new URL(request.url);
  const type = (url.searchParams.get("type") ?? "").trim().toLowerCase();
  const template = GUIDED_SESSION_TEMPLATES.find((t) => t.id === type);
  if (!template) {
    return apiError(request, new ApiError("VALIDATION_FAILED", "Unknown workout type."));
  }

  // Only the template's own parameters are read; buildGuidedSession clamps each to its bounds, so a
  // missing or out-of-range value falls back to the template default rather than producing junk.
  const params: Record<string, number> = {};
  for (const param of template.params) {
    const raw = url.searchParams.get(param.key);
    if (raw !== null) {
      const value = Number(raw);
      if (Number.isFinite(value)) params[param.key] = value;
    }
  }

  const structure = buildGuidedSession(template, params);
  const steps = flattenStructure(structure).map((step) => ({
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
    // Not a plan, and not tied to a workout row — the app labels the session by the chosen type.
    workoutId: null,
    title: null,
    fromPlan: false,
    steps,
  });
});
