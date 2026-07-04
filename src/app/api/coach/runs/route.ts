import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { createRunnerRun, getRunnerRuns } from "@/lib/coach/service";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const url = new URL(request.url);
    const requested = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    // Clamp to a sane range so a caller can't request an unbounded page.
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 50;
    const runs = await getRunnerRuns(session.user.id, limit);
    return NextResponse.json({ data: runs, meta: { count: runs.length } });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const limited = enforceRateLimit(rateLimitKey("coach-run", session.user.id), 30, 60_000);
  if (limited) return limited;

  try {
    const result = await createRunnerRun(session.user.id, await readCoachJson(request));
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

