import { timingSafeEqual } from "crypto";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { computeS256Challenge, createMobileSession, sha256 } from "@/lib/api/v1/tokens";
import { toMeDto } from "@/lib/api/v1/dto";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

const meSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
  phone: true,
  gender: true,
  dateOfBirth: true,
  wilaya: true,
  city: true,
  emailVerifiedAt: true,
  mfaEnabled: true,
  language: true,
  theme: true,
  profilePrivate: true,
  distanceUnit: true
} as const;

/**
 * Redeem the authorization code from /api/v1/auth/authorize for a device session (RFC 7636 §4.6).
 *
 * The code is single-use and only usable together with the PKCE verifier that produced the stored
 * challenge, so a malicious app that intercepted the zidrun:// redirect holds a dead value.
 */
export const POST = withApi(async (request) => {
  const ip = clientIp(request.headers);
  const limited = enforceRateLimit(`v1-token:${ip ?? "unknown"}`, 20, 10 * 60_000);
  if (limited) {
    return apiError(request, new ApiError("RATE_LIMITED", "Too many attempts. Try again shortly."));
  }

  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : "";
  const verifier = typeof body.codeVerifier === "string" ? body.codeVerifier : "";

  // RFC 7636 §4.1 length bounds. A short verifier would make the challenge guessable.
  if (!code || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
    throw new ApiError("BAD_REQUEST", "This sign-in could not be completed. Please try again.");
  }

  const prisma = getPrisma();
  const row = await prisma.mobileAuthCode.findUnique({
    where: { codeHash: sha256(code) },
    select: { id: true, userId: true, codeChallenge: true, expiresAt: true, usedAt: true }
  });

  const invalid = new ApiError("BAD_REQUEST", "This sign-in could not be completed. Please try again.");
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    // One message for missing/expired/already-redeemed: distinguishing them tells an attacker
    // holding an intercepted code whether it is still live.
    throw invalid;
  }

  const expected = Buffer.from(row.codeChallenge);
  const actual = Buffer.from(computeS256Challenge(verifier));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    // A wrong verifier means someone other than the app that started this flow is redeeming the
    // code. Burn it so the real app cannot be raced to it either.
    await prisma.mobileAuthCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    logSecurityEvent("mobile_pkce_verifier_mismatch", { userId: row.userId });
    throw invalid;
  }

  // Single-use: claim atomically so two concurrent redemptions cannot both mint a session.
  const claimed = await prisma.mobileAuthCode.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() }
  });
  if (claimed.count !== 1) throw invalid;

  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { ...meSelect, blockedAt: true } });
  if (!user || user.blockedAt) {
    throw new ApiError("ACCOUNT_BLOCKED", "This account cannot sign in.");
  }

  const tokens = await createMobileSession(user.id, {
    platform: typeof body.platform === "string" ? body.platform : "android",
    appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
    deviceName: typeof body.deviceName === "string" ? body.deviceName : undefined
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  logSecurityEvent("login_success", { userId: user.id, email: user.email, provider: "pkce-browser", client: "native" });

  return apiOk(request, { tokens, user: toMeDto(user) });
});
