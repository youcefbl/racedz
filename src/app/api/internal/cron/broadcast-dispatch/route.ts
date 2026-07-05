import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { dispatchPendingBroadcasts } from "@/lib/broadcasts";

// Constant-time compare so the secret can't be recovered via response timing.
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Scheduled/resumable fan-out for admin broadcasts. The compose action kicks an
// inline first batch, but large segments are drained here — an external cron should
// POST on a short cadence while sends are in flight:
//
//   curl -fsS -X POST https://zidrun.com/api/internal/cron/broadcast-dispatch \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// Guarded by CRON_SECRET; refuses when the secret is unset so it's never world-open.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-cron-secret");
  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await dispatchPendingBroadcasts();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Broadcast dispatch job failed", error);
    return NextResponse.json({ error: "Dispatch job failed." }, { status: 500 });
  }
}
