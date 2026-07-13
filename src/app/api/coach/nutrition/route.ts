import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { getRecentNutrition, logNutritionEntry } from "@/lib/coach/nutrition";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });
  const days = await getRecentNutrition(session.user.id, 7);
  return NextResponse.json({ data: days });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const limited = enforceRateLimit(rateLimitKey("coach-nutrition", session.user.id), 60, 60_000);
  if (limited) return limited;

  try {
    const entry = await logNutritionEntry(session.user.id, await readCoachJson(request));
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
