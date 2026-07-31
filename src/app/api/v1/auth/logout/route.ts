import { apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { revokeRefreshToken } from "@/lib/api/v1/tokens";

export const dynamic = "force-dynamic";

/**
 * Sign out this device. Deliberately unauthenticated and always 200: a user tapping "log out" with
 * an already-expired access token must still be able to revoke the refresh token, and revoking an
 * unknown token is a harmless no-op. The refresh token itself is the authorization here — only the
 * device that holds it can revoke its own family.
 */
export const POST = withApi(async (request) => {
  const body = (await readJsonBody(request)) as Record<string, unknown>;
  if (typeof body.refreshToken === "string") {
    await revokeRefreshToken(body.refreshToken);
  }
  return apiOk(request, { signedOut: true });
});
