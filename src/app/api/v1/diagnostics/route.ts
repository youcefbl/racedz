import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { optionalMobileUser } from "@/lib/api/v1/guard";
import { clientIp, enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { diagnosticBatchSchema, storeDiagnosticReports } from "@/lib/runs/telemetry";

export const dynamic = "force-dynamic";

/**
 * Crash, process-exit and issue reports from the app (src/lib/runs/telemetry.ts).
 *
 * Authentication is optional: a crash during sign-in or after sign-out is exactly the kind worth
 * seeing. Signed-in reports are linked to the account so an issue can be traced to the runner who
 * hit it; anonymous ones are rate-limited by address.
 */
export const POST = withApi(async (request) => {
  const viewer = await optionalMobileUser(request);
  const key = viewer ? rateLimitKey("v1-diagnostics", viewer.id) : rateLimitKey("v1-diagnostics-anon", clientIp(request.headers) ?? "unknown");
  const limited = enforceRateLimit(key, viewer ? 60 : 20, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many reports. Try again later."));

  const parsed = diagnosticBatchSchema.safeParse(await readJsonBody(request, 512 * 1024));
  if (!parsed.success) {
    console.warn("[api/v1][diagnostics] rejected fields:", Object.keys(parsed.error.flatten().fieldErrors).join(", "));
    throw new ApiError("VALIDATION_FAILED", "Invalid diagnostic report.");
  }
  const stored = await storeDiagnosticReports(viewer?.id ?? null, parsed.data.reports);
  return apiOk(request, { stored }, { status: 201 });
});
