import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { toggleFollow } from "@/lib/social";

// Toggle following a runner. Body: { userId }. Idempotent — returns the resulting follow state.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const limited = enforceRateLimit(rateLimitKey("social-follow", session.user.id), 60, 60_000);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
  const targetId = typeof body?.userId === "string" ? body.userId : "";
  if (!targetId) return NextResponse.json({ error: "A userId is required." }, { status: 400 });

  const result = await toggleFollow(session.user.id, targetId);
  return NextResponse.json({ data: result });
}
