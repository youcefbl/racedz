import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminRaces } from "@/lib/admin";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();

  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
  }

  const limited = enforceRateLimit(rateLimitKey("admin-read", session.user.id), 60, 5 * 60_000);
  if (limited) return limited;

  const { items, total } = await getAdminRaces({});

  return NextResponse.json({
    data: items,
    meta: {
      count: total
    }
  });
}
