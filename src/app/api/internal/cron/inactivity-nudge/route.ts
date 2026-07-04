import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { nudgeInactiveRunners } from "@/lib/coach/reminders";

// Constant-time string compare so the secret can't be recovered via response timing.
// Returns early only on length mismatch (which timingSafeEqual requires); the byte
// comparison itself never short-circuits.
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Scheduled job: nudge runners who have gone quiet to keep training. There is no in-process
// scheduler, so an external trigger (host crontab, a cron container, or any uptime-cron service)
// should POST here on a daily cadence with the shared secret:
//
//   curl -fsS -X POST https://zidrun.com/api/internal/cron/inactivity-nudge \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// Guarded by CRON_SECRET; constant-time-ish compare and a hard refusal when the secret is unset
// so the endpoint is never world-open by accident.
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
    const result = await nudgeInactiveRunners();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Inactivity nudge job failed", error);
    return NextResponse.json({ error: "Nudge job failed." }, { status: 500 });
  }
}
