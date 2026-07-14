import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserRegistrations } from "@/lib/registrations";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required" }, { status: 401 });
  }

  // Bounded so the query can't be unbounded; 200 is far above any realistic per-user count.
  const { items: registrations, total } = await getUserRegistrations(session.user.id, { page: 1, limit: 200, skip: 0 });

  return NextResponse.json({
    data: registrations,
    meta: {
      count: total
    }
  });
}
