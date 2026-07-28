import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { searchRunners } from "@/lib/social";

// Find runners by name to follow. Query: ?q=. Excludes the caller and private profiles.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const limited = enforceRateLimit(rateLimitKey("social-search", session.user.id), 30, 60_000);
  if (limited) return limited;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchRunners(session.user.id, q);
  return NextResponse.json({ data: results });
}
