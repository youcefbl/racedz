import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getPrisma } from "@/lib/db";
import { fetchForecastConditions, resolveCoordinates } from "@/lib/coach/weather";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Live conditions for the Start Run screen: current temperature, humidity, and wind at the point
 * the runner is about to set off from.
 *
 * Location comes from the `lat`/`lng` query params (the device's GPS fix) when present and valid;
 * otherwise it falls back to the centroid of the runner's saved wilaya, so a runner who hasn't
 * granted location — or is indoors without a fix — still gets regional weather. Both signals feed
 * the same resolveCoordinates helper the coach uses, so the app and the website read one source.
 *
 * Weather is a best-effort enrichment (see src/lib/coach/weather.ts): when it is disabled or the
 * upstream provider is slow/unreachable the endpoint answers UNAVAILABLE rather than blocking.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-weather", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const url = new URL(request.url);
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const lat = latRaw !== null ? Number(latRaw) : NaN;
  const lng = lngRaw !== null ? Number(lngRaw) : NaN;
  const hasCoords =
    Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;

  // Coordinates supplied but nonsensical is a client bug worth flagging, distinct from "none given"
  // which legitimately falls through to the wilaya lookup below.
  if ((latRaw !== null || lngRaw !== null) && !hasCoords) {
    return apiError(request, new ApiError("VALIDATION_FAILED", "lat and lng must be valid coordinates."));
  }

  const wilaya = hasCoords ? null : await getUserWilaya(viewer.id);
  const coordinates = resolveCoordinates({
    route: hasCoords ? [{ lat, lng }] : undefined,
    wilaya,
  });
  if (!coordinates) {
    return apiError(
      request,
      new ApiError("BAD_REQUEST", "Provide lat and lng, or set your wilaya, to get weather.")
    );
  }

  const conditions = await fetchForecastConditions(coordinates);
  if (!conditions) {
    return apiError(request, new ApiError("UNAVAILABLE", "Weather is unavailable right now. Please try again."));
  }

  return apiOk(request, {
    temperatureC: conditions.currentTemperatureC,
    apparentC: conditions.apparentTemperatureC,
    humidityPct: conditions.humidityPct,
    windSpeedKmh: conditions.windKph,
    windDirectionDegrees: conditions.windDirectionDegrees,
    weatherLabel: conditions.label,
    // Whether the reading is the runner's exact GPS point or their wilaya centroid, so the app can
    // caption it ("near your area") when it is only regional.
    source: conditions.source,
  });
});

/** The runner's saved wilaya, used to locate weather when the device sends no GPS fix. */
async function getUserWilaya(userId: string): Promise<string | null> {
  const rows = await getPrisma().$queryRaw<Array<{ wilaya: string | null }>>`
    SELECT "wilaya" FROM "User" WHERE "id" = ${userId} LIMIT 1
  `;
  return rows[0]?.wilaya ?? null;
}
