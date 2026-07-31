import { apiOk, readJsonBody, withApi, ApiError, apiError } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { postUserSupportMessage } from "@/lib/support";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

/**
 * Account-deletion request.
 *
 * This does NOT delete anything. Deleting a runner cascades into race registrations an organizer
 * has already accepted payment for, results, and audit rows, so the platform handles it as a
 * reviewed support request rather than a one-tap irreversible action from a phone — the same path
 * the website offers. The app is responsible for telling the user exactly that; do not word the
 * button as if the account disappears immediately.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const limited = enforceRateLimit(rateLimitKey("v1-deletion-request", viewer.id), 3, 24 * 60 * 60_000);
  if (limited) {
    return apiError(request, new ApiError("RATE_LIMITED", "A deletion request is already being processed."));
  }

  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  const message = [
    "Account deletion requested from the Android app.",
    reason ? `Reason given: ${reason}` : "No reason given."
  ].join("\n");

  await postUserSupportMessage(viewer.id, message);
  logSecurityEvent("account_deletion_requested", { userId: viewer.id });

  // The session is deliberately left alive: the request is answered in the support thread, and
  // signing the user out here would take away the only place they can read that answer.
  return apiOk(request, { submitted: true });
});
