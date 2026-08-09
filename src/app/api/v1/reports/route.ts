import { ZodError } from "zod";
import { apiError, apiOk, ApiError, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { createReport, ReportError, reportInputSchema } from "@/lib/reports";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Report a race, a run, or a runner — the mobile twin of /api/reports.
 *
 * Reuses createReport, so the app cannot report anything the website could not: the same target
 * allowlist, the same categories, the same existence check, and the same one-OPEN-report-per-
 * reporter-per-target deduplication. A second implementation would eventually let the phone file
 * reports the moderation queue does not know how to action.
 *
 * Ships now rather than with the social feed because the app already shows other people's
 * content — every race is published by an organizer — and a listing with no way to report a scam
 * is the gap this closes. It is also a precondition for `NATGAP-04`: the moment native shows other
 * runners' runs, shipping without this would be user-generated content with no report path.
 *
 * The rate limit is deliberately tight (5/minute). Reporting is a moderation signal, and a client
 * able to file hundreds is a way to bury a real report in noise.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-report", viewer.id), 5, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many reports. Try again shortly."));

  try {
    const input = reportInputSchema.parse(await readJsonBody(request));
    const report = await createReport({ reporterId: viewer.id, input });
    return apiOk(request, { id: report.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError("VALIDATION_FAILED", "Please pick a reason.");
    }
    if (error instanceof ReportError) {
      // The reason matters to the reporter — "already reported" is a different answer from
      // "that no longer exists", and both are things they can act on.
      throw new ApiError(error.status === 404 ? "NOT_FOUND" : "CONFLICT", error.message);
    }
    throw error;
  }
});
