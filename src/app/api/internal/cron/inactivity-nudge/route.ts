import { NextResponse } from "next/server";
import { nudgeInactiveRunners } from "@/lib/coach/reminders";

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
  if (provided !== secret) {
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
