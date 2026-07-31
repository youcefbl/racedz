import "server-only";

import { getPrisma } from "@/lib/db";
import { ApiError } from "@/lib/api/v1/http";
import { verifyAccessToken } from "@/lib/api/v1/tokens";
import type { UserRole } from "@/types/race";

export type MobileUser = {
  id: string;
  email: string;
  role: UserRole;
  /** MobileSession.familyId of the device that made this call. */
  sessionId: string;
};

/**
 * Authenticate an /api/v1 request from the `Authorization: Bearer <access token>` header.
 *
 * A valid signature is necessary but not sufficient. The live User row is re-read on every call to
 * confirm the account still exists, is not blocked, and has not bumped `securityStampAt` since the
 * token was minted — a password reset, MFA enroll/disable, block, or role change therefore
 * invalidates every outstanding access token within its 15-minute lifetime rather than at expiry.
 * This mirrors what the web JWT callback does in src/auth.ts; the mobile client just carries the
 * stamp in the token instead of the cookie.
 *
 * The failure code is deliberately the same (SESSION_EXPIRED) for "no token", "bad signature",
 * "expired", and "stamp bumped": the app's response is identical — refresh, then re-login — and a
 * caller probing this endpoint learns nothing about which condition it hit.
 */
export async function requireMobileUser(request: Request): Promise<MobileUser> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    throw new ApiError("UNAUTHENTICATED", "Sign in to continue.");
  }

  const claims = verifyAccessToken(token);
  if (!claims) {
    throw new ApiError("SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }

  const user = await getPrisma().user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, role: true, blockedAt: true, securityStampAt: true }
  });

  if (!user) {
    throw new ApiError("SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }
  if (user.blockedAt) {
    throw new ApiError("ACCOUNT_BLOCKED", "This account has been blocked.");
  }
  if (claims.sst < user.securityStampAt.getTime()) {
    throw new ApiError("SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }

  return {
    id: user.id,
    email: user.email,
    // Role comes from the database, never from the token: a demotion must take effect now.
    role: user.role as UserRole,
    sessionId: claims.sid
  };
}

/** Same as requireMobileUser but returns null instead of throwing, for endpoints that are public
 *  yet personalize when a token happens to be present (e.g. race detail showing "you're registered"). */
export async function optionalMobileUser(request: Request): Promise<MobileUser | null> {
  try {
    return await requireMobileUser(request);
  } catch {
    return null;
  }
}
