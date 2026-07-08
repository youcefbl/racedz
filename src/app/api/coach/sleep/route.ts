import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { createSleepEntry, getSleepEntries } from "@/lib/coach/service";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const url = new URL(request.url);
    const requested = Number.parseInt(url.searchParams.get("days") ?? "30", 10);
    // Clamp so a caller can't request an unbounded history window.
    const days = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 90) : 30;
    const entries = await getSleepEntries(session.user.id, days);
    return NextResponse.json({ data: entries, meta: { count: entries.length } });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  // Text entries trigger a billed AI parse, so keep the per-minute ceiling modest.
  const limited = enforceRateLimit(rateLimitKey("coach-sleep", session.user.id), 20, 60_000);
  if (limited) return limited;

  try {
    const result = await createSleepEntry(session.user.id, await readCoachJson(request));
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
