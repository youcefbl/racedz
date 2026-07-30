import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markAllNotificationsRead } from "@/lib/notifications";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(rateLimitKey("notifications-api", session.user.id), 60, 5 * 60_000);
  if (limited) return limited;

  await markAllNotificationsRead(session.user.id);

  return NextResponse.json({ ok: true });
}
