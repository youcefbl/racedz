import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notification = await createNotification({
    userId: session.user.id,
    type: "TEST_PUSH",
    title: "RaceDZ push test",
    body: "Browser push is connected for this account.",
    href: "/account/notification-settings",
    channels: ["IN_APP", "PUSH"]
  });
  const deliveries = await getPrisma().$queryRaw<Array<{ status: string; error: string | null }>>`
    SELECT "status", "error"
    FROM "NotificationDelivery"
    WHERE "notificationId" = ${notification.id}
      AND "channel" = 'PUSH'
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const pushDelivery = deliveries[0] ?? null;

  return NextResponse.json({
    ok: true,
    notificationId: notification.id,
    pushDelivery
  });
}
