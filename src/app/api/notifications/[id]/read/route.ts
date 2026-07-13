import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markNotificationRead } from "@/lib/notifications";

// Mark a single notification read (scoped to the owner). Used when a user clicks a notification in
// the bell dropdown — replacing the previous mark-all-read-on-open behavior.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await markNotificationRead(session.user.id, id);

  return NextResponse.json({ ok: true });
}
