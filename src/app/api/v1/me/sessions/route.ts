import { apiOk, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { listUserSessions } from "@/lib/api/v1/tokens";

export const dynamic = "force-dynamic";

/**
 * Devices currently signed in to this account, so the Privacy & data screen can show them and offer
 * "sign out everywhere". `current` marks the device making the request; the app must not offer to
 * revoke only that one from this list (that is what plain logout does).
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const sessions = await listUserSessions(viewer.id);

  return apiOk(
    request,
    sessions.map((session) => ({
      id: session.familyId,
      platform: session.platform,
      appVersion: session.appVersion,
      deviceName: session.deviceName,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      current: session.familyId === viewer.sessionId
    }))
  );
});
