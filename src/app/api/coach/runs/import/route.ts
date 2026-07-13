import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse } from "@/lib/coach/http";
import { GpxError, parseGpx } from "@/lib/coach/gpx";
import { createRunnerRun } from "@/lib/coach/service";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

// Import a run from an uploaded .gpx file (from a watch or another app). Parses the track, derives
// distance/duration, and creates a RunnerRun with source=IMPORTED — reusing createRunnerRun so the
// imported run gets the same elevation/weather/calories enrichment as a recorded one.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const limited = enforceRateLimit(rateLimitKey("coach-import", session.user.id), 10, 60_000);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a GPX file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A GPX file is required." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "That GPX file is too large (max 5 MB)." }, { status: 413 });

  const effortRaw = Number.parseInt(String(form.get("perceivedEffort") ?? "5"), 10);
  const perceivedEffort = Number.isFinite(effortRaw) ? Math.min(10, Math.max(1, effortRaw)) : 5;
  const isPublic = String(form.get("isPublic") ?? "") === "true";

  let parsed;
  try {
    parsed = parseGpx(await file.text());
  } catch (error) {
    if (error instanceof GpxError) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Could not read that GPX file." }, { status: 422 });
  }

  try {
    const result = await createRunnerRun(session.user.id, {
      startedAt: parsed.startedAt.toISOString(),
      distanceKm: parsed.distanceKm,
      durationSeconds: parsed.durationSeconds,
      route: parsed.route,
      source: "IMPORTED",
      perceivedEffort,
      isPublic,
      title: parsed.name ?? "Imported run"
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
