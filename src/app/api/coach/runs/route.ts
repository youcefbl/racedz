import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { createRunnerRun, getRunnerRuns } from "@/lib/coach/service";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    const runs = await getRunnerRuns(session.user.id, Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ data: runs, meta: { count: runs.length } });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const ip = clientIp(request.headers);
  if (ip) {
    const limit = checkRateLimit(`coach-run:${ip}`, 30, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
  }

  try {
    const result = await createRunnerRun(session.user.id, await readCoachJson(request));
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

