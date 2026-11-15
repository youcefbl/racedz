import { z } from "zod";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { recordRunSessionEnd, runSessionEndSchema } from "@/lib/runs/telemetry";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ clientId: string }> };

/** A recording ended on the phone: finished (save comes separately), discarded, or dropped. */
export const PATCH = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const limited = enforceRateLimit(rateLimitKey("v1-run-session", viewer.id), 30, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const { clientId } = await context.params;
  if (!z.string().uuid().safeParse(clientId).success) throw new ApiError("VALIDATION_FAILED", "Invalid run session.");

  const parsed = runSessionEndSchema.safeParse(await readJsonBody(request, 16 * 1024));
  if (!parsed.success) {
    console.warn("[api/v1][run-sessions] rejected fields:", Object.keys(parsed.error.flatten().fieldErrors).join(", "));
    throw new ApiError("VALIDATION_FAILED", "Invalid run session.");
  }
  const session = await recordRunSessionEnd(viewer.id, clientId, parsed.data);
  return apiOk(request, session);
});
