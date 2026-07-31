import { apiOk, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { revokeAllUserSessions } from "@/lib/api/v1/tokens";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

/** Sign out every device for the authenticated user, including the one making the call. */
export const POST = withApi(async (request) => {
  const user = await requireMobileUser(request);
  const revoked = await revokeAllUserSessions(user.id, "LOGOUT_ALL");
  logSecurityEvent("mobile_logout_all", { userId: user.id, revoked });
  return apiOk(request, { signedOut: true, revokedSessions: revoked });
});
