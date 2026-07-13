import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { completePastRaces } from "@/lib/race-lifecycle";

// Constant-time string compare so the secret can't be recovered via response timing.
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Scheduled job: mark PUBLISHED races whose date has passed as COMPLETED. Run once daily (e.g. just
// after midnight):
//
//   curl -fsS -X POST https://zidrun.com/api/internal/cron/complete-past-races \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// Guarded by CRON_SECRET; hard-refuses when the secret is unset. Idempotent.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-cron-secret");
  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await completePastRaces();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Complete-past-races job failed", error);
    Sentry.captureException(error, { tags: { cron: "complete-past-races" } });
    return NextResponse.json({ error: "Complete-past-races job failed." }, { status: 500 });
  }
}
