import { apiError, apiOk, ApiError, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { createNativeAuthToken } from "@/lib/native-auth";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

/**
 * Mint a single-use web-handoff link (NATPAR-002): the native app authenticates with bearer
 * tokens, but web surfaces it opens in a Custom Tab (subscribe/payment, security/MFA, support)
 * authenticate with cookies — so without this, every handoff landed on a login wall.
 *
 * The token is purpose-bound (`WEB_HANDOFF` — refused by the WebView bridge door) and carries its
 * destination and the minting mobile session server-side, so the URL exposes nothing to tamper
 * with and /auth/handoff can refuse tokens whose session was revoked between mint and click.
 * Consumption requires a user gesture on a same-origin confirmation page (DD6-R02): a link alone
 * — sent to a victim, prefetched, or embedded — can no longer set a session cookie.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  // Each mint is a sign-in-capable secret; keep the ceiling low.
  const limited = enforceRateLimit(rateLimitKey("v1-web-handoff", viewer.id), 10, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const body = (await readJsonBody(request)) as { next?: unknown };
  const requested = typeof body.next === "string" ? body.next : "";
  // Same-origin internal paths only — a handoff link must never bounce the signed-in browser to
  // an arbitrary host ("//evil.example" is a protocol-relative external URL, hence the double
  // check). Anything else falls back to the account home.
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested.slice(0, 500) : "/account";

  const token = await createNativeAuthToken(viewer.id, {
    purpose: "WEB_HANDOFF",
    destination: next,
    mobileSessionFamilyId: viewer.sessionId,
  });
  logSecurityEvent("web_handoff_minted", {
    userId: viewer.id,
    destination: next,
    mobileSessionFamilyId: viewer.sessionId,
  });
  return apiOk(request, {
    path: `/auth/handoff?token=${encodeURIComponent(token)}`,
    // Matches the NativeAuthToken TTL; the client should open the link immediately.
    expiresInSeconds: 300,
  });
});
