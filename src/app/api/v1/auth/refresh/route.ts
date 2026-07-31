import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { rotateRefreshToken } from "@/lib/api/v1/tokens";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Exchange a refresh token for a new access token, rotating the refresh token in the process.
 * The old refresh token is dead the moment this succeeds, so the app must persist the new pair
 * before using it. Reuse of a rotated token revokes the whole device family — see
 * rotateRefreshToken in src/lib/api/v1/tokens.ts.
 */
export const POST = withApi(async (request) => {
  const ip = clientIp(request.headers);
  // Generous: a legitimate app refreshes roughly every 15 minutes, but a device coming back from
  // a long offline stretch can burst. Tight enough to make brute-forcing a 256-bit token pointless.
  const limited = enforceRateLimit(`v1-refresh:${ip ?? "unknown"}`, 60, 10 * 60_000);
  if (limited) {
    return apiError(request, new ApiError("RATE_LIMITED", "Too many refresh attempts. Try again shortly."));
  }

  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";

  const outcome = await rotateRefreshToken(refreshToken, {
    platform: typeof body.platform === "string" ? body.platform : "android",
    appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
    deviceName: typeof body.deviceName === "string" ? body.deviceName : undefined
  });

  if (!outcome.ok) {
    if (outcome.reason === "reuse") {
      // Distinct code so the app can show "you were signed out for security" rather than a plain
      // expiry message. It carries no secret: the caller already presented the token.
      throw new ApiError(
        "REFRESH_REUSE_DETECTED",
        "You were signed out because this session was used from somewhere else. Please sign in again."
      );
    }
    throw new ApiError("SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }

  return apiOk(request, { tokens: outcome.tokens });
});
