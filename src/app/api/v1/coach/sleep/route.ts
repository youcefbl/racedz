import { apiError, apiOk, ApiError, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getCoachEntitlementWithUsage } from "@/lib/coach/entitlement";
import { createSleepEntry, getSleepEntries } from "@/lib/coach/service";
import { CoachError } from "@/lib/coach/errors";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Recent nights, newest first. */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-sleep", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const entitlement = await getCoachEntitlementWithUsage(viewer.id);
  if (entitlement.tier === "NONE") return apiOk(request, { entries: [] });

  const entries = await getSleepEntries(viewer.id);
  return apiOk(
    request,
    {
      entries: entries.map((entry) => ({
        id: entry.id,
        night: entry.night.toISOString(),
        durationMinutes: entry.durationMinutes,
        bedTime: entry.bedTime,
        wakeTime: entry.wakeTime,
        note: entry.note,
        source: entry.source,
      })),
    }
  );
});

/**
 * Log a night's sleep.
 *
 * Reuses createSleepEntry(), so the duration derivation (from bed/wake times when no explicit
 * duration is given) and the one-entry-per-night rule behave identically to the website. Sleep is
 * health data: it feeds the coach's recovery advice, so a second implementation that rounded
 * differently would quietly change the advice a runner gets.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-sleep-log", viewer.id), 30, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many entries. Try again shortly."));

  try {
    const entry = await createSleepEntry(viewer.id, await readJsonBody(request));
    return apiOk(request, entry, { status: 201 });
  } catch (error) {
    if (error instanceof CoachError) {
      throw new ApiError(error.status === 409 ? "CONFLICT" : "VALIDATION_FAILED", error.message);
    }
    if (error instanceof Error && error.name === "ZodError") {
      throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields.");
    }
    throw error;
  }
});
