import { z } from "zod";
import { apiError, apiOk, ApiError, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { revokePushSubscription, upsertPushSubscription } from "@/lib/notifications";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const pushSubscriptionSchema = z.object({
  token: z.string().min(20).max(4096),
  deviceLabel: z.string().trim().max(120).optional(),
});

/**
 * Registers this device's FCM token — the mobile twin of /api/notifications/push-subscriptions.
 *
 * Reuses upsertPushSubscription, so the native app lands in the same `PushSubscription` table the
 * website and the Capacitor app use, with `provider = "firebase"`. That matters more than it looks:
 * the three dispatch crons (training reminder, inactivity nudge, broadcast) already select from
 * that table, so a registered native device starts receiving from them with no change to the
 * sending side at all.
 *
 * Idempotent by token — FCM hands the same token back on every launch, and a device that
 * re-registers on each cold start must not accumulate rows.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-push-subscriptions", viewer.id), 60, 5 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Try again shortly."));

  const parsed = pushSubscriptionSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "A valid push token is required.");

  await upsertPushSubscription({
    userId: viewer.id,
    token: parsed.data.token,
    deviceLabel: parsed.data.deviceLabel,
  });

  return apiOk(request, { registered: true });
});

/**
 * Revokes this device's token — on sign-out, or when FCM tells the app the token is dead.
 *
 * Scoped to the caller's own subscriptions inside revokePushSubscription, so possessing a token
 * string is not enough to unregister someone else's device.
 */
export const DELETE = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-push-subscriptions", viewer.id), 60, 5 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Try again shortly."));

  const parsed = pushSubscriptionSchema.pick({ token: true }).safeParse(await readJsonBody(request));
  if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "A valid push token is required.");

  await revokePushSubscription({ userId: viewer.id, token: parsed.data.token });

  return apiOk(request, { revoked: true });
});
