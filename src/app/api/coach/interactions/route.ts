import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { createCoachInteraction } from "@/lib/coach/service";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  // Burst limiter keyed on the session id — an IP header is client-spoofable and can be
  // rotated to bypass the limit; the entitlement quota is the per-user cost cap behind this.
  const limited = enforceRateLimit(rateLimitKey("coach-interaction", session.user.id), 20, 60_000);
  if (limited) return limited;

  try {
    const result = await createCoachInteraction(session.user.id, await readCoachJson(request));
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

