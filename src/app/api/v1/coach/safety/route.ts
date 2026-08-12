import { z } from "zod";
import { apiError, apiOk, ApiError, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { confirmCoachMedicalClearance, getCoachSafetyAlert } from "@/lib/coach/safety-hold";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const clearanceSchema = z.object({
  action: z.literal("CONFIRM_MEDICAL_CLEARANCE"),
  confirmed: z.literal(true)
});

export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const limited = enforceRateLimit(rateLimitKey("v1-coach-safety", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));
  return apiOk(request, { alert: await getCoachSafetyAlert(viewer.id) });
});

export const PATCH = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const limited = enforceRateLimit(rateLimitKey("v1-coach-safety-update", viewer.id), 10, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const parsed = clearanceSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "Confirm medical clearance to continue.");
  const cleared = await confirmCoachMedicalClearance(viewer.id);
  if (!cleared) throw new ApiError("NOT_FOUND", "No active exercise hold was found.");
  return apiOk(request, { cleared: true });
});
