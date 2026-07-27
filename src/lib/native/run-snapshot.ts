import type { RunRoutePoint } from "@/components/coach/types";

export type ActiveRunSnapshot = {
  v: 2;
  userId: string;
  status: "tracking" | "paused";
  startTs: number;
  pausedAccum: number;
  distanceM: number;
  elevationM: number;
  movingSec: number;
  lastPointTs: number;
  effort: number;
  share: boolean;
  title?: string;
  description?: string;
  cadenceSteps?: number;
  watcherId?: string;
  route: RunRoutePoint[];
  updatedAt: number;
};

type SnapshotRecord = Record<string, unknown>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRoutePoint(value: unknown): value is RunRoutePoint {
  if (!value || typeof value !== "object") return false;
  const point = value as SnapshotRecord;
  return (
    isFiniteNumber(point.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    isFiniteNumber(point.lng) &&
    point.lng >= -180 &&
    point.lng <= 180 &&
    (point.ele == null || isFiniteNumber(point.ele)) &&
    (point.t == null || isFiniteNumber(point.t))
  );
}

export function parseActiveRunSnapshot(value: string, expectedUserId: string, now = Date.now()): ActiveRunSnapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const snapshot = parsed as SnapshotRecord;
  if ((snapshot.v !== 1 && snapshot.v !== 2) || snapshot.userId !== expectedUserId) return null;
  if (snapshot.status !== "tracking" && snapshot.status !== "paused") return null;
  if (
    !isFiniteNumber(snapshot.startTs) ||
    !isFiniteNumber(snapshot.pausedAccum) ||
    !isFiniteNumber(snapshot.distanceM) ||
    !isFiniteNumber(snapshot.elevationM) ||
    !isFiniteNumber(snapshot.movingSec) ||
    !isFiniteNumber(snapshot.lastPointTs) ||
    !isFiniteNumber(snapshot.effort) ||
    typeof snapshot.share !== "boolean" ||
    !Array.isArray(snapshot.route) ||
    !snapshot.route.every(isRoutePoint) ||
    !isFiniteNumber(snapshot.updatedAt)
  ) {
    return null;
  }
  if (
    snapshot.startTs <= 0 ||
    snapshot.startTs > now + 5 * 60_000 ||
    snapshot.updatedAt < snapshot.startTs ||
    snapshot.updatedAt > now + 5 * 60_000 ||
    snapshot.pausedAccum < 0 ||
    snapshot.distanceM < 0 ||
    snapshot.movingSec < 0 ||
    snapshot.effort < 1 ||
    snapshot.effort > 10 ||
    snapshot.route.length > 20_000
  ) {
    return null;
  }
  if (snapshot.title != null && typeof snapshot.title !== "string") return null;
  if (snapshot.description != null && typeof snapshot.description !== "string") return null;
  if (snapshot.cadenceSteps != null && !isFiniteNumber(snapshot.cadenceSteps)) return null;
  if (snapshot.watcherId != null && typeof snapshot.watcherId !== "string") return null;

  return {
    v: 2,
    userId: expectedUserId,
    status: snapshot.status,
    startTs: snapshot.startTs,
    pausedAccum: Math.max(0, snapshot.pausedAccum),
    distanceM: Math.max(0, snapshot.distanceM),
    elevationM: Math.max(0, snapshot.elevationM),
    movingSec: Math.max(0, snapshot.movingSec),
    lastPointTs: snapshot.lastPointTs,
    effort: snapshot.effort,
    share: snapshot.share,
    title: typeof snapshot.title === "string" ? snapshot.title.slice(0, 120) : undefined,
    description: typeof snapshot.description === "string" ? snapshot.description.slice(0, 2000) : undefined,
    cadenceSteps: isFiniteNumber(snapshot.cadenceSteps) ? Math.max(0, Math.round(snapshot.cadenceSteps)) : 0,
    watcherId: typeof snapshot.watcherId === "string" ? snapshot.watcherId.slice(0, 200) : undefined,
    route: snapshot.route,
    updatedAt: snapshot.updatedAt
  };
}
