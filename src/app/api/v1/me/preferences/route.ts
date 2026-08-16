import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { normalizeLocale, normalizeTheme } from "@/lib/appearance";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Appearance and privacy preferences. Stored on the User row (the same `language` / `theme` /
 * `profilePrivate` columns the website writes) so a runner's choice follows them between the
 * website, the Capacitor app, and this one instead of being device-local state.
 */
export const PATCH = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const limited = enforceRateLimit(rateLimitKey("v1-preferences", viewer.id), 60, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many updates. Try again shortly."));

  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const data: { language?: string; theme?: string; profilePrivate?: boolean; distanceUnit?: string } = {};

  if (body.language !== undefined) {
    const language = normalizeLocale(body.language);
    if (!language) throw new ApiError("VALIDATION_FAILED", "Unsupported language.");
    data.language = language;
  }
  if (body.theme !== undefined) {
    const theme = normalizeTheme(body.theme);
    if (!theme) throw new ApiError("VALIDATION_FAILED", "Unsupported theme.");
    data.theme = theme;
  }
  if (body.profilePrivate !== undefined) {
    if (typeof body.profilePrivate !== "boolean") {
      throw new ApiError("VALIDATION_FAILED", "profilePrivate must be true or false.");
    }
    data.profilePrivate = body.profilePrivate;
  }

  // Distance unit (NATRUN-06.8): "km" or "mi"; stored on the account so it follows the runner across
  // devices and never leaks across an account switch on a shared phone. Null/absent means km.
  if (body.distanceUnit !== undefined) {
    if (body.distanceUnit !== "km" && body.distanceUnit !== "mi") {
      throw new ApiError("VALIDATION_FAILED", "distanceUnit must be km or mi.");
    }
    data.distanceUnit = body.distanceUnit;
  }

  if (Object.keys(data).length === 0) {
    throw new ApiError("BAD_REQUEST", "No preference was supplied.");
  }

  const user = await getPrisma().user.update({
    where: { id: viewer.id },
    data,
    select: { language: true, theme: true, profilePrivate: true, distanceUnit: true }
  });

  return apiOk(request, { ...user, distanceUnit: user.distanceUnit === "mi" ? "mi" : "km" });
});
