import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFeed } from "@/lib/social";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

// Activity feed: public runs from people you follow + your own. Cursor-paginated.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });
  const limited = enforceRateLimit(rateLimitKey("social-api", session.user.id), 120, 5 * 60_000);
  if (limited) return limited;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const requested = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 50) : 20;

  const result = await getFeed(session.user.id, { cursor, limit });
  return NextResponse.json({ data: result.runs, meta: { nextCursor: result.nextCursor } });
}
