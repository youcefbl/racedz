import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getRunnerBadges, getRunnerRecords } from "@/lib/coach/service";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * The runner's achievements, earned and locked.
 *
 * Reuses getRunnerBadges() so the catalogue, the thresholds, and the progress arithmetic are the
 * ones the website already shows — a second implementation for mobile would eventually disagree
 * about whether something was earned, which is exactly the kind of difference a runner notices.
 *
 * Badges are computed on read from runs, records, and race finishes; there is no award pipeline or
 * stored state, so they cannot drift out of sync with the underlying numbers.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-badges", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const records = await getRunnerRecords(viewer.id);
  const badges = await getRunnerBadges(viewer.id, records);

  return apiOk(request, {
    badges,
    earnedCount: badges.filter((badge) => badge.earned).length,
    // The streak the overview leads with, so the client does not re-derive it from a partial
    // page of runs and disagree with the badge that depends on it.
    longestStreakWeeks: records.longestStreakWeeks,
    totalRuns: records.totalRuns,
    totalDistanceKm: Math.round(records.totalDistanceKm * 10) / 10,
  });
});
