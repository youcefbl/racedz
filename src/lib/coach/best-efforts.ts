import type { RunRoutePoint } from "@/components/coach/types";

/**
 * Best efforts: the fastest contiguous 1 km / 5 km / 10 km inside a recorded route.
 *
 * Pure and dependency-free like run-stats.ts, so it runs identically on save, on backfill and in
 * tests. Deliberately conservative — a "best 5 km" that was really a GPS teleport or a bus ride is
 * worse than no number, so a window is only reported when every sample inside it is trustworthy:
 *
 *  - only timestamps count; a route without them yields nothing (never inferred from average pace);
 *  - the route is cut into stretches at every gap ≥ MAX_MOVING_GAP_S (signal loss, a pause) and at
 *    every non-finite / zero-length / teleporting segment; a window never spans a cut;
 *  - a window is skipped when its own pace is beyond human (faster than MIN_PLAUSIBLE_PACE_S_PER_KM);
 *  - crossing time is interpolated inside the segment that closes the distance, so a 5.02 km run
 *    can still report a 5 km effort measured to the metre.
 *
 * Runs shorter than a target simply have no effort for it. Ties are resolved by the caller (the
 * earliest run keeps the record); this file only measures.
 */

export const BEST_EFFORT_DISTANCES_M = [1000, 5000, 10000] as const;
export type BestEffortDistanceM = (typeof BEST_EFFORT_DISTANCES_M)[number];

/** Same ceiling as the recorder and run-stats: longer is not moving time, and not one effort. */
const MAX_MOVING_GAP_S = 15;
/** A single segment longer than this at 1 Hz is a jump, not a stride (the phone rejects >60 m). */
const MAX_SEGMENT_M = 120;
/** 2:00/km — well past any human; a window this fast is bad data, not a record. */
const MIN_PLAUSIBLE_PACE_S_PER_KM = 120;
const BOUNDARY_TOLERANCE_M = 0.5;

export type BestEffort = {
  distanceM: number;
  /** Elapsed seconds over the effort, interpolated at the closing boundary. */
  seconds: number;
  /** Index of the first route point of the effort. */
  startIndex: number;
  /** Index of the route point that closes (or contains the close of) the effort. */
  endIndex: number;
};

const EARTH_RADIUS_M = 6371000;
function metersBetween(a: RunRoutePoint, b: RunRoutePoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Stretch = {
  /** Route index of each sample in the stretch. */
  index: number[];
  /** Cumulative metres from the stretch start, per sample. */
  cumM: number[];
  /** Cumulative seconds from the stretch start, per sample. */
  cumS: number[];
};

/** Cuts the route into contiguous, trustworthy stretches. */
function stretches(points: RunRoutePoint[]): Stretch[] {
  const out: Stretch[] = [];
  let current: Stretch | null = null;
  const close = () => {
    if (current && current.index.length >= 2) out.push(current);
    current = null;
  };
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (typeof p?.t !== "number" || !Number.isFinite(p.t) || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
      close();
      continue;
    }
    if (!current) {
      current = { index: [i], cumM: [0], cumS: [0] };
      continue;
    }
    const prevIndex = current.index[current.index.length - 1];
    const prev = points[prevIndex];
    const seconds = (p.t - (prev.t as number)) / 1000;
    const meters = metersBetween(prev, p);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= MAX_MOVING_GAP_S || !Number.isFinite(meters) || meters > MAX_SEGMENT_M) {
      close();
      current = { index: [i], cumM: [0], cumS: [0] };
      continue;
    }
    current.index.push(i);
    current.cumM.push(current.cumM[current.cumM.length - 1] + meters);
    current.cumS.push(current.cumS[current.cumS.length - 1] + seconds);
  }
  close();
  return out;
}

/**
 * The fastest window of at least `distanceM` metres, or null.
 *
 * Two pointers per stretch: for every start sample, the end pointer only ever moves forward, so a
 * 1500-point route costs a few thousand comparisons per distance, not millions.
 */
function fastestWindow(stretchList: Stretch[], distanceM: number): BestEffort | null {
  let best: BestEffort | null = null;
  for (const s of stretchList) {
    const n = s.index.length;
    // Half a metre of tolerance: a run of exactly 5.000 km must not miss its 5 km effort to
    // floating-point summation, and no GPS route is accurate to less than that anyway.
    const target = distanceM - BOUNDARY_TOLERANCE_M;
    if (s.cumM[n - 1] < target) continue;
    let j = 1;
    for (let i = 0; i < n - 1; i += 1) {
      if (j <= i) j = i + 1;
      while (j < n && s.cumM[j] - s.cumM[i] < target) j += 1;
      if (j >= n) break;
      // Interpolate the crossing inside segment (j-1, j).
      const segM = s.cumM[j] - s.cumM[j - 1];
      const segS = s.cumS[j] - s.cumS[j - 1];
      const overshoot = s.cumM[j] - s.cumM[i] - distanceM;
      const fraction = segM > 0 ? Math.min(1, Math.max(0, overshoot / segM)) : 0;
      const seconds = s.cumS[j] - s.cumS[i] - fraction * segS;
      if (!(seconds > 0)) continue;
      const paceSPerKm = (seconds / distanceM) * 1000;
      if (paceSPerKm < MIN_PLAUSIBLE_PACE_S_PER_KM) continue;
      if (!best || seconds < best.seconds) {
        best = { distanceM, seconds, startIndex: s.index[i], endIndex: s.index[j] };
      }
    }
  }
  return best;
}

/**
 * All reportable best efforts for a route. Empty for routes without timestamps, shorter than 1 km,
 * or made only of untrustworthy stretches.
 */
export function computeBestEfforts(
  points: RunRoutePoint[] | null | undefined,
  distances: readonly number[] = BEST_EFFORT_DISTANCES_M
): BestEffort[] {
  if (!points || points.length < 2) return [];
  const list = stretches(points);
  if (list.length === 0) return [];
  const out: BestEffort[] = [];
  for (const d of distances) {
    const effort = fastestWindow(list, d);
    if (effort) out.push(effort);
  }
  return out;
}

/** Seconds rounded to whole seconds for storage/display; sub-second precision is GPS noise. */
export function roundEffortSeconds(seconds: number): number {
  return Math.max(1, Math.round(seconds));
}
