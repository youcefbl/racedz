import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, requestId, withApi } from "@/lib/api/v1/http";
import { createMobileSession } from "@/lib/api/v1/tokens";
import { toMeDto } from "@/lib/api/v1/dto";
import { verifyLoginCredentials, verifyMfaCode } from "@/lib/auth-credentials";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";
import { loginSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/**
 * Email + password sign-in for the native app.
 *
 * Reuses verifyLoginCredentials/verifyMfaCode — the exact helpers the website's Auth.js credentials
 * provider calls — so password checking, the email-verified requirement, the blocked-account check,
 * and the second factor cannot drift between the two clients. The only mobile-specific part is what
 * gets handed back: a device session (access + refresh token) instead of a cookie.
 *
 * MFA is a two-call flow: post without `totp` and an MFA-enabled account answers MFA_REQUIRED, then
 * the app posts the same credentials plus the code. The password is re-verified on the second call,
 * so MFA_REQUIRED is not a bypassable checkpoint — there is no intermediate credential to steal.
 */
export const POST = withApi(async (request) => {
  const ip = clientIp(request.headers);
  const limited = enforceRateLimit(`v1-login:${ip ?? "unknown"}`, 10, 10 * 60_000);
  if (limited) {
    return apiError(request, new ApiError("RATE_LIMITED", "Too many sign-in attempts. Try again shortly."), {
      "Retry-After": limited.headers.get("Retry-After") ?? "600"
    });
  }

  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const parsed = loginSchema.safeParse({ email: body.email, password: body.password });
  if (!parsed.success) {
    // Same generic answer as a wrong password: a malformed email must not be distinguishable
    // from an unregistered one.
    throw new ApiError("INVALID_CREDENTIALS", "That email or password is not correct.");
  }

  const user = await verifyLoginCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    logSecurityEvent("login_failure", { email: parsed.data.email, reason: "invalid_credentials", client: "native" });
    throw new ApiError("INVALID_CREDENTIALS", "That email or password is not correct.");
  }

  if (user.mfaEnabled) {
    const totp = typeof body.totp === "string" ? body.totp : "";
    if (!totp) {
      throw new ApiError("MFA_REQUIRED", "Enter the code from your authenticator app.");
    }
    if (!(await verifyMfaCode(user, totp))) {
      logSecurityEvent("login_failure", { email: user.email, userId: user.id, reason: "invalid_mfa_code", client: "native" });
      throw new ApiError("MFA_INVALID", "That code is not valid. Try again.");
    }
  }

  const now = new Date();
  const record = await getPrisma().user.update({
    where: { id: user.id },
    data: { lastLoginAt: now, firstLoginAt: user.firstLoginAt ?? now },
    select: {
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
    }
  });

  const tokens = await createMobileSession(user.id, {
    platform: typeof body.platform === "string" ? body.platform : "android",
    appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
    deviceName: typeof body.deviceName === "string" ? body.deviceName : undefined
  });

  logSecurityEvent("login_success", {
    email: user.email,
    userId: user.id,
    role: user.role,
    provider: "credentials",
    client: "native",
    requestId: requestId(request)
  });

  return apiOk(request, { tokens, user: toMeDto(record) });
});
