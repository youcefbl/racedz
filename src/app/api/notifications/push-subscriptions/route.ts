import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { revokePushSubscription, upsertPushSubscription } from "@/lib/notifications";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/http/body";

const pushSubscriptionSchema = z.object({
  token: z.string().min(20),
  deviceLabel: z.string().max(120).optional()
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(rateLimitKey("notifications-api", session.user.id), 60, 5 * 60_000);
  if (limited) return limited;

  const parsed = pushSubscriptionSchema.safeParse(await readBoundedJson(request).catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  await upsertPushSubscription({
    userId: session.user.id,
    token: parsed.data.token,
    deviceLabel: parsed.data.deviceLabel
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(rateLimitKey("notifications-api", session.user.id), 60, 5 * 60_000);
  if (limited) return limited;

  const parsed = pushSubscriptionSchema.pick({ token: true }).safeParse(await readBoundedJson(request).catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  await revokePushSubscription({
    userId: session.user.id,
    token: parsed.data.token
  });

  return NextResponse.json({ ok: true });
}
