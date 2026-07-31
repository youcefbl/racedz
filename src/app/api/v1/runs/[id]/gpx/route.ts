import { NextResponse } from "next/server";
import { ApiError, apiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getPrisma } from "@/lib/db";
import { buildGpx } from "@/lib/coach/gpx";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * One of the caller's runs as a .gpx file.
 *
 * Reuses buildGpx() so the file is byte-identical to the website's export — a runner comparing an
 * app export against a web export, or importing both into Strava, must not see two different tracks
 * for the same run.
 *
 * Returns the file directly rather than the JSON envelope: the client hands it to the system share
 * sheet, and wrapping a document in `{data}` would mean decoding before writing it.
 */
export const GET = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { id } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-run-gpx", viewer.id), 30, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many exports. Try again shortly."));

  // Scoped to the caller: a route is where this person actually ran, so another runner's id must
  // read as absent rather than forbidden.
  const run = await getPrisma().runnerRun.findFirst({
    where: { id, userId: viewer.id, deletedAt: null },
    select: { id: true, title: true, startedAt: true, route: true },
  });
  if (!run) throw new ApiError("NOT_FOUND", "This run was not found.");

  const route = Array.isArray(run.route) ? run.route : [];
  if (route.length < 2) {
    throw new ApiError("VALIDATION_FAILED", "This run has no route to export.");
  }

  const gpx = buildGpx({ name: run.title, startedAt: run.startedAt, route: route as never });
  const filename = `zidrun-${run.startedAt.toISOString().slice(0, 10)}-${run.id.slice(0, 6)}.gpx`;

  return new NextResponse(gpx, {
    status: 200,
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
