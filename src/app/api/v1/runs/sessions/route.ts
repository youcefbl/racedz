import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { recordRunSessionStart, runSessionStartSchema } from "@/lib/runs/telemetry";

export const dynamic = "force-dynamic";

/**
 * A recording started on the phone (see src/lib/runs/telemetry.ts).
 *
 * Sent from the phone's telemetry queue, so it may arrive late or twice; it is keyed by the
 * recording's clientId and idempotent. Never blocks a run: the phone records whether or not this
 * succeeds.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const limited = enforceRateLimit(rateLimitKey("v1-run-session", viewer.id), 30, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const parsed = runSessionStartSchema.safeParse(await readJsonBody(request, 16 * 1024));
  if (!parsed.success) {
    console.warn("[api/v1][run-sessions] rejected fields:", Object.keys(parsed.error.flatten().fieldErrors).join(", "));
    throw new ApiError("VALIDATION_FAILED", "Invalid run session.");
  }
  const session = await recordRunSessionStart(viewer.id, parsed.data);
  return apiOk(request, session, { status: 201 });
});
