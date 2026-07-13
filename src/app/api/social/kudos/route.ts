import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { toggleKudos } from "@/lib/social";

// Toggle kudos on a run. Body: { runId }. Returns { kudoed, count }.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const limited = enforceRateLimit(rateLimitKey("social-kudos", session.user.id), 120, 60_000);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { runId?: unknown } | null;
  const runId = typeof body?.runId === "string" ? body.runId : "";
  if (!runId) return NextResponse.json({ error: "A runId is required." }, { status: 400 });

  try {
    const result = await toggleKudos(session.user.id, runId);
    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ error: "Run was not found." }, { status: 404 });
  }
}
