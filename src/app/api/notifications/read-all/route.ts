import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markAllNotificationsRead } from "@/lib/notifications";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await markAllNotificationsRead(session.user.id);

  return NextResponse.json({ ok: true });
}
