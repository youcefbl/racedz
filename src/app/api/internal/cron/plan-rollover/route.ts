import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { rolloverTrainingPlans } from "@/lib/coach/reminders";

// Constant-time string compare so the secret can't be recovered via response timing.
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Scheduled job: auto-generate + activate next week's plan for runners whose active plan has ended,
// then notify them. Run once each morning BEFORE the training-reminder job, so today's run exists
// when the reminder fires:
//
//   curl -fsS -X POST https://zidrun.com/api/internal/cron/plan-rollover \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// Guarded by CRON_SECRET; hard-refuses when the secret is unset. Idempotent — runners already
// covered for the current week are skipped.
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
    const result = await rolloverTrainingPlans();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Plan rollover job failed", error);
    return NextResponse.json({ error: "Rollover job failed." }, { status: 500 });
  }
}
