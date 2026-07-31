import "server-only";

import { createHmac, randomBytes, randomUUID, createHash, timingSafeEqual } from "crypto";
import { getPrisma } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security-log";
import type { UserRole } from "@/types/race";

// Device-session tokens for the native app (/api/v1). Two token types, deliberately different:
//
//   access  — stateless HS256 JWT, 15 minutes. Sent on every API call. Carries the user id, role,
//             session id, and the security stamp the session was minted against. Verified without
//             a DB round trip for signature/expiry, then checked against the live User row so a
//             password reset / MFA change / block / role change logs the device out immediately
//             (same securityStampAt mechanism the web JWT uses — see src/auth.ts).
//   refresh — opaque 256-bit random string, 60 days, stored only as a SHA-256 hash in
//             MobileSession. Rotated on every use. Presenting an already-rotated token means the
//             token leaked and is being replayed, so the whole family is revoked.
//
// Neither token ever appears in a URL, a log line, a push payload, or an error message.

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export type MobileTokenPair = {
  accessToken: string;
  /** Seconds until `accessToken` expires — the app refreshes proactively before this elapses. */
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: string;
  sessionId: string;
};

export type AccessClaims = {
  sub: string;
  role: UserRole;
  /** MobileSession.familyId — identifies the device, survives refresh rotation. */
  sid: string;
  /** User.securityStampAt in ms at mint time. */
  sst: number;
  iat: number;
  exp: number;
};

function secret(): string {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set; cannot sign mobile access tokens.");
  return value;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function signAccessToken(claims: Omit<AccessClaims, "iat" | "exp">): { token: string; expiresIn: number } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: AccessClaims = { ...claims, iat: issuedAt, exp: issuedAt + ACCESS_TTL_SECONDS };
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  return { token: `${header}.${body}.${sign(`${header}.${body}`)}`, expiresIn: ACCESS_TTL_SECONDS };
}

/**
 * Verify signature and expiry only. The caller still has to confirm the security stamp and block
 * state against the database — a valid signature alone must never be enough to act as a user.
 */
export function verifyAccessToken(token: string): AccessClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = Buffer.from(sign(`${header}.${body}`));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AccessClaims;
    if (typeof claims.sub !== "string" || typeof claims.sid !== "string") return null;
    if (typeof claims.sst !== "number" || typeof claims.exp !== "number") return null;
    if (claims.exp * 1000 <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

type DeviceInfo = { platform?: string; appVersion?: string; deviceName?: string };

/** Coarse, user-recognizable device metadata only. Anything longer is truncated, not rejected. */
function normalizeDevice(device: DeviceInfo | undefined) {
  const clamp = (value: unknown, max: number) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
  return {
    platform: clamp(device?.platform, 24) ?? "android",
    appVersion: clamp(device?.appVersion, 32),
    deviceName: clamp(device?.deviceName, 64)
  };
}

async function mintAccessFor(userId: string, familyId: string): Promise<{ accessToken: string; expiresIn: number }> {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { role: true, securityStampAt: true }
  });
  if (!user) throw new Error("Cannot mint an access token for a user that no longer exists.");

  const { token, expiresIn } = signAccessToken({
    sub: userId,
    role: user.role as UserRole,
    sid: familyId,
    sst: user.securityStampAt.getTime()
  });
  return { accessToken: token, expiresIn };
}

/** Start a brand-new device session (first login on this device). */
export async function createMobileSession(userId: string, device?: DeviceInfo): Promise<MobileTokenPair> {
  const familyId = randomUUID();
  return issueRefreshRow(userId, familyId, device);
}

async function issueRefreshRow(userId: string, familyId: string, device?: DeviceInfo): Promise<MobileTokenPair> {
  const refreshToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const info = normalizeDevice(device);

  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { securityStampAt: true }
  });
  if (!user) throw new Error("Cannot issue a refresh token for a user that no longer exists.");

  await getPrisma().mobileSession.create({
    data: {
      userId,
      familyId,
      refreshTokenHash: sha256(refreshToken),
      platform: info.platform,
      // Recorded so rotateRefreshToken() can tell whether the stamp moved after this device
      // authenticated. Rotation carries the current value forward, so a bump between any two
      // refreshes is caught.
      securityStamp: user.securityStampAt,
      appVersion: info.appVersion,
      deviceName: info.deviceName,
      expiresAt
    }
  });

  const access = await mintAccessFor(userId, familyId);
  return {
    accessToken: access.accessToken,
    expiresIn: access.expiresIn,
    refreshToken,
    refreshExpiresAt: expiresAt.toISOString(),
    sessionId: familyId
  };
}

export type RefreshOutcome =
  | { ok: true; tokens: MobileTokenPair }
  | { ok: false; reason: "invalid" | "expired" | "reuse" | "blocked" };

/**
 * Rotate a refresh token. On success the presented row is marked ROTATED and a fresh row joins the
 * same family. Presenting a row that is already revoked is refresh-token reuse: the entire family
 * is revoked so both the attacker's copy and the legitimate device are forced to sign in again,
 * which is the point — a silent takeover is worse than an unexpected logout.
 */
export async function rotateRefreshToken(refreshToken: string, device?: DeviceInfo): Promise<RefreshOutcome> {
  if (!refreshToken || refreshToken.length < 20) return { ok: false, reason: "invalid" };

  const prisma = getPrisma();
  const row = await prisma.mobileSession.findUnique({
    where: { refreshTokenHash: sha256(refreshToken) },
    select: { id: true, userId: true, familyId: true, revokedAt: true, expiresAt: true, securityStamp: true }
  });

  if (!row) return { ok: false, reason: "invalid" };

  if (row.revokedAt) {
    await revokeFamily(row.familyId, "REUSE_DETECTED");
    logSecurityEvent("mobile_refresh_reuse_detected", { userId: row.userId, familyId: row.familyId });
    return { ok: false, reason: "reuse" };
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.mobileSession.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), revokedReason: "EXPIRED" }
    });
    return { ok: false, reason: "expired" };
  }

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { blockedAt: true, securityStampAt: true }
  });
  if (!user || user.blockedAt) {
    await revokeFamily(row.familyId, "LOGOUT_ALL");
    return { ok: false, reason: "blocked" };
  }

  // A password reset, MFA change, or role change must kill the refresh token too, not only the
  // 15-minute access token. Without this a stolen refresh token stays good for its full 60 days and
  // can mint fresh access tokens indefinitely — the reset the user performed to lock an attacker
  // out would not have locked them out at all.
  if (user.securityStampAt.getTime() > row.securityStamp.getTime()) {
    await revokeFamily(row.familyId, "SECURITY_STAMP_CHANGED");
    return { ok: false, reason: "expired" };
  }

  // Claim the row atomically so two concurrent refreshes (app foregrounded twice, retry after a
  // timeout) cannot both rotate it and hand out two live successors.
  const claimed = await prisma.mobileSession.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: "ROTATED", lastUsedAt: new Date() }
  });
  if (claimed.count !== 1) return { ok: false, reason: "invalid" };

  return { ok: true, tokens: await issueRefreshRow(row.userId, row.familyId, device) };
}

/** Sign out one device. Idempotent: an unknown or already-revoked token is a no-op success. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  const row = await getPrisma().mobileSession.findUnique({
    where: { refreshTokenHash: sha256(refreshToken) },
    select: { familyId: true }
  });
  if (row) await revokeFamily(row.familyId, "LOGOUT");
}

export async function revokeFamily(familyId: string, reason: string): Promise<void> {
  await getPrisma().mobileSession.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason }
  });
}

/** Sign out every device for a user (logout-all, and after a security-sensitive account change). */
export async function revokeAllUserSessions(userId: string, reason = "LOGOUT_ALL"): Promise<number> {
  const result = await getPrisma().mobileSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason }
  });
  return result.count;
}

export async function listUserSessions(userId: string) {
  return getPrisma().mobileSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    // Only the fields a user needs to recognize their own device. No token hash, no IP.
    select: { id: true, familyId: true, platform: true, appVersion: true, deviceName: true, createdAt: true, lastUsedAt: true },
    orderBy: { lastUsedAt: "desc" },
    take: 50
  });
}

export { ACCESS_TTL_SECONDS };

/**
 * PKCE S256 code challenge for a verifier (RFC 7636 §4.2). Lives here rather than in the route
 * file because Next.js App Router route modules may only export HTTP method handlers.
 */
export function computeS256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
