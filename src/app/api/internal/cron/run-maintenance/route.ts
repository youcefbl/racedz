import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { evaluatePendingRunDistances } from "@/lib/runs/distance-correction";
import { runTelemetryMaintenance } from "@/lib/runs/telemetry";

// Constant-time string compare so the secret can't be recovered via response timing.
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Scheduled job (nightly): re-evaluate run distances not yet judged by the current
// DISTANCE_ALGO_VERSION, mark run sessions that never became a run as ABANDONED, and apply the
// telemetry retention windows.
//
//   curl -fsS -X POST https://zidrun.com/api/internal/cron/run-maintenance \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// Guarded by CRON_SECRET; hard-refuses when the secret is unset. Idempotent and bounded per call.
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
    const distances = await evaluatePendingRunDistances();
    const telemetry = await runTelemetryMaintenance();
    console.log("[cron][run-maintenance]", JSON.stringify({ distances, telemetry }));
    return NextResponse.json({ data: { distances, telemetry } });
  } catch (error) {
    console.error("Run maintenance job failed", error);
    Sentry.captureException(error, { tags: { cron: "run-maintenance" } });
    return NextResponse.json({ error: "Run maintenance job failed." }, { status: 500 });
  }
}
