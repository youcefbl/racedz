import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { calculateAveragePaceSecondsPerKm } from "@/lib/coach/metrics";

/**
 * Server-side distance correction for GPS runs.
 *
 * The phone measures distance live, and a bug there is a wrong number in every runner's history —
 * on 2026-11-14 a 1.33 km walk saved as 0.167 km because the recorder dropped sub-metre steps. The
 * route the phone uploads is independent evidence: this module re-measures it, compares, and
 * corrects the run when the phone clearly lost distance.
 *
 * ## How it improves over time
 *
 * - Every evaluation is stored in `RunDistanceEvaluation` with the device model and app version,
 *   so `getDistanceCalibrationReport()` shows which phones/builds disagree with their own routes.
 * - The algorithm is versioned. Improving [measureRoute]/[decideDistance] and bumping
 *   [DISTANCE_ALGO_VERSION] makes the nightly job re-evaluate every run from its original phone
 *   value — a run's distance is always re-derivable, never a one-way edit.
 * - The phone's value is preserved in `deviceDistanceKm` the first time a run is corrected.
 *
 * ## What it will not do
 *
 * It only corrects upward automatically. A route is a chain of chords over the real path (and long
 * routes are thinned on the phone), so a route shorter than the phone's distance is weak evidence
 * of over-counting; those runs are FLAGGED for review instead. Manual and imported runs and runs
 * not classified VALID are never touched.
 */
export const DISTANCE_ALGO_VERSION = 1;

export type RoutePoint = { lat: number; lng: number; t?: number | null };

export type RouteMeasurement = {
  distanceM: number;
  movingSeconds: number;
  pointCount: number;
  timedPoints: number;
  rejectedPoints: number;
  longGaps: number;
  /** 90th percentile of point-to-point speed (m/s) — separates a run from a drive. */
  speedP90Mps: number;
  /** 0–1. */
  confidence: number;
};

export type DistanceDecision =
  | { decision: "APPLIED"; reason: string; appliedKm: number; movingSeconds: number }
  | { decision: "KEPT" | "FLAGGED" | "SKIPPED"; reason: string };

/** Implied speed above which a jump between two points is a bad fix, not movement. */
function maxSegmentSpeedMps(sport: string): number {
  return sport === "RIDE" ? 25 : 12;
}

/**
 * 90th-percentile point speed above which a route is not a foot activity (a car, a bus, an
 * emulator replay), whatever the run is labelled. 7 m/s is a 2:23/km pace sustained over a tenth
 * of the route — beyond any runner this app serves.
 */
function maxP90SpeedMps(sport: string): number {
  return sport === "RIDE" ? 20 : 7;
}

/** Average moving speed above which a "corrected" foot activity would be implausible. */
function maxAverageSpeedMps(sport: string): number {
  return sport === "RIDE" ? 20 : 7;
}

/** Below this between two points, the runner was stopped and the displacement is drift. */
const MIN_MOVING_SPEED_MPS = 0.2;
/** A gap longer than this cannot be bridged with a straight line. */
const MAX_BRIDGE_GAP_S = 600;
/** Displacement from the last counted point before the next stretch counts (route has no accuracy). */
const ROUTE_STEP_FLOOR_M = 3;
/** The phone thins routes to this many points; a route this long has lost resolution on curves. */
const THINNED_ROUTE_POINTS = 1400;
const MIN_POINTS = 10;

export function haversineMeters(a: RoutePoint, b: RoutePoint): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function parseRoute(route: unknown): RoutePoint[] {
  if (!Array.isArray(route)) return [];
  const points: RoutePoint[] = [];
  for (const raw of route) {
    if (!raw || typeof raw !== "object") continue;
    const { lat, lng, t } = raw as Record<string, unknown>;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    points.push({ lat, lng, t: typeof t === "number" && Number.isFinite(t) ? t : null });
  }
  return points;
}

/**
 * Measures a stored route.
 *
 * Distance accumulates from the last counted point (the same idea as the phone's
 * DistanceAccumulator) so dense, jittery routes are not inflated; teleports are dropped; gaps
 * longer than [MAX_BRIDGE_GAP_S] are not bridged. Moving time is the sum of point-to-point
 * intervals above walking-drift speed.
 */
export function measureRoute(points: RoutePoint[], sport: string): RouteMeasurement {
  const empty: RouteMeasurement = { distanceM: 0, movingSeconds: 0, pointCount: points.length, timedPoints: 0, rejectedPoints: 0, longGaps: 0, speedP90Mps: 0, confidence: 0 };
  if (points.length < 2) return empty;

  const maxSpeed = maxSegmentSpeedMps(sport);
  let distanceM = 0;
  let movingSeconds = 0;
  let rejectedPoints = 0;
  let longGaps = 0;
  const speeds: number[] = [];
  const timedPoints = points.filter((p) => p.t != null).length;

  let base = points[0];
  let last = points[0];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const step = haversineMeters(last, p);
    const dt = p.t != null && last.t != null ? (p.t - last.t) / 1000 : null;

    if (dt != null && dt > 0) speeds.push(step / dt);
    if (dt != null && dt <= 0) {
      rejectedPoints++;
      continue;
    }
    if (dt != null && step / dt > maxSpeed) {
      // A bad fix: ignore it entirely and keep measuring from the previous point.
      rejectedPoints++;
      continue;
    }
    if (dt != null && dt > MAX_BRIDGE_GAP_S) {
      longGaps++;
      base = p;
      last = p;
      continue;
    }
    if (dt != null && step / dt >= MIN_MOVING_SPEED_MPS) movingSeconds += dt;

    const fromBase = haversineMeters(base, p);
    if (fromBase >= ROUTE_STEP_FLOOR_M) {
      const span = p.t != null && base.t != null ? (p.t - base.t) / 1000 : null;
      // Drift while stopped walks the base away slowly; that is not distance.
      if (span == null || span <= 0 || fromBase / span >= MIN_MOVING_SPEED_MPS) distanceM += fromBase;
      base = p;
    }
    last = p;
  }

  let confidence = 1;
  if (points.length < MIN_POINTS) confidence = 0;
  // Without timestamps neither teleports nor stops can be told apart: below the trust threshold.
  if (timedPoints < points.length * 0.9) confidence *= 0.4;
  if (rejectedPoints > points.length * 0.1) confidence *= 0.6;
  if (longGaps > 0) confidence *= 0.8;
  if (points.length >= THINNED_ROUTE_POINTS) confidence *= 0.9;

  speeds.sort((a, b) => a - b);
  const speedP90Mps = speeds.length > 0 ? speeds[Math.min(speeds.length - 1, Math.floor(speeds.length * 0.9))] : 0;

  return {
    distanceM,
    movingSeconds: Math.round(movingSeconds),
    speedP90Mps: Math.round(speedP90Mps * 100) / 100,
    pointCount: points.length,
    timedPoints,
    rejectedPoints,
    longGaps,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export type RunFacts = {
  /** What the phone measured — the original, even if the run was corrected before. */
  deviceKm: number;
  deviceMovingSeconds: number | null;
  durationSeconds: number;
  source: string;
  validity: string;
  sport: string;
};

/** Pure decision: what the run's distance should be under this algorithm version. */
export function decideDistance(run: RunFacts, m: RouteMeasurement): DistanceDecision {
  if (run.source !== "GPS") return { decision: "SKIPPED", reason: "not_gps" };
  if (run.validity !== "VALID") return { decision: "SKIPPED", reason: "not_valid" };
  if (m.pointCount < MIN_POINTS) return { decision: "SKIPPED", reason: "route_too_short" };
  if (m.confidence < 0.5) return { decision: "SKIPPED", reason: "low_confidence" };

  const routeKm = m.distanceM / 1000;
  if (routeKm < 0.05) return { decision: "SKIPPED", reason: "route_too_short" };

  if (routeKm >= run.deviceKm * 1.1 && routeKm - run.deviceKm >= 0.05) {
    // A route that moves like a vehicle is not evidence the phone lost distance on foot.
    if (m.speedP90Mps > maxP90SpeedMps(run.sport)) return { decision: "FLAGGED", reason: "non_foot_speeds" };
    const movingSeconds = Math.min(run.durationSeconds, Math.max(run.deviceMovingSeconds ?? 0, m.movingSeconds));
    if (movingSeconds <= 0) return { decision: "FLAGGED", reason: "no_moving_time" };
    if (m.distanceM / movingSeconds > maxAverageSpeedMps(run.sport)) return { decision: "FLAGGED", reason: "implausible_speed" };
    return { decision: "APPLIED", reason: "device_undercounted", appliedKm: Math.round(routeKm * 1000) / 1000, movingSeconds };
  }
  if (run.deviceKm >= routeKm * 1.25 && run.deviceKm - routeKm >= 0.2) {
    return { decision: "FLAGGED", reason: "device_overcounted" };
  }
  return { decision: "KEPT", reason: "agree" };
}

type EvaluatedRun = {
  id: string;
  userId: string;
  clientId: string | null;
  distanceKm: number;
  deviceDistanceKm: number | null;
  durationSeconds: number;
  movingTimeSeconds: number | null;
  source: string;
  validity: string;
  sport: string;
  route: unknown;
};

const evaluatedRunSelect = {
  id: true,
  userId: true,
  clientId: true,
  distanceKm: true,
  deviceDistanceKm: true,
  durationSeconds: true,
  movingTimeSeconds: true,
  source: true,
  validity: true,
  sport: true,
  route: true,
} satisfies Prisma.RunnerRunSelect;

/**
 * Evaluates one run under the current algorithm, records the evaluation, and makes the run's
 * distance match the decision — the route measurement when APPLIED, the phone's original value
 * otherwise (which reverts an earlier correction a newer algorithm no longer stands behind).
 */
export async function evaluateRunDistance(runId: string): Promise<DistanceDecision | null> {
  const prisma = getPrisma();
  const run = (await prisma.runnerRun.findUnique({ where: { id: runId }, select: evaluatedRunSelect })) as EvaluatedRun | null;
  if (!run) return null;

  const deviceKm = run.deviceDistanceKm ?? run.distanceKm;
  // A corrected run's movingTimeSeconds may be the server's; the phone's original is not stored
  // separately, so the larger of the two is used — it never shrinks moving time on re-evaluation.
  const measurement = measureRoute(parseRoute(run.route), run.sport);
  const decision = decideDistance(
    { deviceKm, deviceMovingSeconds: run.movingTimeSeconds, durationSeconds: run.durationSeconds, source: run.source, validity: run.validity, sport: run.sport },
    measurement,
  );

  const session = run.clientId
    ? await prisma.runSession.findUnique({
        where: { userId_clientId: { userId: run.userId, clientId: run.clientId } },
        select: { appVersion: true, deviceModel: true },
      })
    : null;

  const targetKm = decision.decision === "APPLIED" ? decision.appliedKm : deviceKm;
  const changes = Math.abs(targetKm - run.distanceKm) > 0.0005;

  await prisma.$transaction(async (tx) => {
    await tx.runDistanceEvaluation.upsert({
      where: { runId_algoVersion: { runId: run.id, algoVersion: DISTANCE_ALGO_VERSION } },
      create: {
        runId: run.id,
        algoVersion: DISTANCE_ALGO_VERSION,
        deviceKm,
        routeKm: measurement.distanceM / 1000,
        routeMovingSeconds: measurement.movingSeconds,
        pointCount: measurement.pointCount,
        confidence: measurement.confidence,
        decision: decision.decision,
        reason: decision.reason,
        appliedKm: decision.decision === "APPLIED" ? decision.appliedKm : null,
        sport: run.sport as never,
        appVersion: session?.appVersion ?? null,
        deviceModel: session?.deviceModel ?? null,
      },
      update: {
        deviceKm,
        routeKm: measurement.distanceM / 1000,
        routeMovingSeconds: measurement.movingSeconds,
        pointCount: measurement.pointCount,
        confidence: measurement.confidence,
        decision: decision.decision,
        reason: decision.reason,
        appliedKm: decision.decision === "APPLIED" ? decision.appliedKm : null,
      },
    });

    if (changes) {
      const movingSeconds = decision.decision === "APPLIED" ? decision.movingSeconds : run.movingTimeSeconds;
      const paceSeconds = movingSeconds && movingSeconds > 0 ? movingSeconds : run.durationSeconds;
      await tx.runnerRun.update({
        where: { id: run.id },
        data: {
          distanceKm: targetKm,
          movingTimeSeconds: movingSeconds,
          averagePaceSecondsPerKm: calculateAveragePaceSecondsPerKm(targetKm, paceSeconds),
          deviceDistanceKm: deviceKm,
          distanceAlgoVersion: DISTANCE_ALGO_VERSION,
          distanceCorrectedAt: decision.decision === "APPLIED" ? new Date() : null,
          // Phones delta-sync on updatedAt; the revision bump tells an editing client it moved.
          revision: { increment: 1 },
        },
      });
    } else {
      // Not a content change: do not bump revision/updatedAt, which would make every phone re-sync.
      await tx.$executeRaw`UPDATE "RunnerRun" SET "distanceAlgoVersion" = ${DISTANCE_ALGO_VERSION} WHERE "id" = ${run.id}`;
    }
  });

  return decision;
}

/** Evaluates runs never evaluated by the current version. Bounded per call; the cron repeats. */
export async function evaluatePendingRunDistances(limit = 300) {
  const prisma = getPrisma();
  const pending = await prisma.runnerRun.findMany({
    where: {
      deletedAt: null,
      source: "GPS",
      OR: [{ distanceAlgoVersion: null }, { distanceAlgoVersion: { lt: DISTANCE_ALGO_VERSION } }],
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const counts: Record<string, number> = { APPLIED: 0, KEPT: 0, FLAGGED: 0, SKIPPED: 0, failed: 0 };
  for (const { id } of pending) {
    try {
      const decision = await evaluateRunDistance(id);
      if (decision) counts[decision.decision] += 1;
    } catch (error) {
      counts.failed += 1;
      console.error("[distance-correction] evaluation failed", id, error);
    }
  }
  return { evaluated: pending.length, ...counts };
}

/**
 * Where phones disagree with their own routes, grouped by device model and app version, for the
 * current algorithm. `medianRatio` is phone ÷ route: 1.0 is perfect, below 1 the phone under-counts.
 */
export async function getDistanceCalibrationReport() {
  const rows = await getPrisma().$queryRaw<
    Array<{ deviceModel: string | null; appVersion: string | null; sport: string; runs: bigint; applied: bigint; flagged: bigint; medianRatio: number | null }>
  >`
    SELECT "deviceModel", "appVersion", "sport"::text AS "sport",
           COUNT(*) AS "runs",
           COUNT(*) FILTER (WHERE "decision" = 'APPLIED') AS "applied",
           COUNT(*) FILTER (WHERE "decision" = 'FLAGGED') AS "flagged",
           percentile_cont(0.5) WITHIN GROUP (ORDER BY "deviceKm" / NULLIF("routeKm", 0)) AS "medianRatio"
    FROM "RunDistanceEvaluation"
    WHERE "algoVersion" = ${DISTANCE_ALGO_VERSION} AND "decision" <> 'SKIPPED'
    GROUP BY 1, 2, 3
    ORDER BY "runs" DESC
  `;
  return rows.map((row) => ({
    ...row,
    runs: Number(row.runs),
    applied: Number(row.applied),
    flagged: Number(row.flagged),
    medianRatio: row.medianRatio == null ? null : Math.round(row.medianRatio * 1000) / 1000,
  }));
}
