import type { RunRoutePoint } from "@/components/coach/types";

// Pure (dependency-free) run analytics derived from the recorded GPS route, so
// they work for every run — including ones recorded before these were added.
// Used by the run summary UI; safe to import on client or server.

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

export type Split = {
  index: number; // 1-based split number
  meters: number; // distance covered in this split (last one may be < splitMeters)
  seconds: number; // time spent in this split
  paceSecondsPerKm: number;
  elevationGainM: number;
  fastest?: boolean;
  slowest?: boolean;
};

export type SeriesPoint = { distanceKm: number; value: number };

function hasTimes(points: RunRoutePoint[]): boolean {
  return points.length > 1 && typeof points[0]?.t === "number" && typeof points[points.length - 1]?.t === "number";
}

/** Per-`splitMeters` (default 1 km) splits with pace + elevation gain. */
export function computeSplits(points: RunRoutePoint[] | null | undefined, splitMeters = 1000): Split[] {
  if (!points || points.length < 2 || !hasTimes(points)) return [];

  const splits: Split[] = [];
  let segMeters = 0;
  let segStartT = points[0].t as number;
  let segGain = 0;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const d = metersBetween(prev, cur);
    if (!Number.isFinite(d) || d <= 0) continue;

    if (prev.ele != null && cur.ele != null) {
      const dz = cur.ele - prev.ele;
      if (dz > 0) segGain += dz;
    }

    segMeters += d;

    if (segMeters >= splitMeters) {
      const seconds = Math.max(1, ((cur.t as number) - segStartT) / 1000);
      splits.push({
        index: splits.length + 1,
        meters: Math.round(segMeters),
        seconds: Math.round(seconds),
        paceSecondsPerKm: Math.round((seconds / segMeters) * 1000),
        elevationGainM: Math.round(segGain)
      });
      segMeters = 0;
      segGain = 0;
      segStartT = cur.t as number;
    }
  }

  // Trailing partial split (only if it's a meaningful remainder).
  if (segMeters >= splitMeters * 0.15) {
    const last = points[points.length - 1];
    const seconds = Math.max(1, ((last.t as number) - segStartT) / 1000);
    splits.push({
      index: splits.length + 1,
      meters: Math.round(segMeters),
      seconds: Math.round(seconds),
      paceSecondsPerKm: Math.round((seconds / segMeters) * 1000),
      elevationGainM: Math.round(segGain)
    });
  }

  // Flag fastest / slowest among full splits for highlighting.
  const full = splits.filter((s) => s.meters >= splitMeters * 0.9);
  if (full.length > 1) {
    let fast = full[0];
    let slow = full[0];
    for (const s of full) {
      if (s.paceSecondsPerKm < fast.paceSecondsPerKm) fast = s;
      if (s.paceSecondsPerKm > slow.paceSecondsPerKm) slow = s;
    }
    fast.fastest = true;
    slow.slowest = true;
  }

  return splits;
}

/**
 * Elevation gain with light smoothing + hysteresis so GPS altitude jitter doesn't
 * inflate the total (raw per-point summing over-counts badly). Returns total
 * positive gain in meters.
 */
export function smoothedElevationGainM(points: RunRoutePoint[] | null | undefined): number {
  if (!points || points.length < 2) return 0;
  const eles = points.map((p) => (typeof p.ele === "number" ? p.ele : null));

  // Moving-average smoothing (window 9) over available altitudes. GPS altitude with no
  // barometer is very noisy (±10-20 m per fix), so a wide window is needed to stop that
  // jitter being summed as fake climb. The real fix is DEM correction (see lib/coach/elevation);
  // this keeps the raw-GPS fallback from wildly over-counting.
  const HALF_WINDOW = 4;
  const smoothed: (number | null)[] = eles.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - HALF_WINDOW); k <= Math.min(eles.length - 1, i + HALF_WINDOW); k += 1) {
      const v = eles[k];
      if (v != null) {
        sum += v;
        n += 1;
      }
    }
    return n ? sum / n : null;
  });

  const THRESHOLD_M = 5; // only count sustained climbs above this (rejects GPS noise)
  let gain = 0;
  let ref: number | null = null;
  for (const v of smoothed) {
    if (v == null) continue;
    if (ref == null) {
      ref = v;
      continue;
    }
    const delta = v - ref;
    if (delta >= THRESHOLD_M) {
      gain += delta;
      ref = v;
    } else if (delta < 0) {
      ref = v; // descending — move the reference down
    }
  }
  return Math.round(gain);
}

/** Elevation profile vs cumulative distance (km), downsampled to ~maxPoints. */
export function elevationSeries(points: RunRoutePoint[] | null | undefined, maxPoints = 120): SeriesPoint[] {
  if (!points || points.length < 2) return [];
  const out: SeriesPoint[] = [];
  let dist = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) dist += metersBetween(points[i - 1], points[i]);
    const ele = points[i].ele;
    if (ele != null) out.push({ distanceKm: dist / 1000, value: ele });
  }
  return downsampleSeries(out, maxPoints);
}

/** Pace profile (sec/km) vs cumulative distance, smoothed over `windowMeters`. */
export function paceSeries(points: RunRoutePoint[] | null | undefined, windowMeters = 250, maxPoints = 120): SeriesPoint[] {
  if (!points || points.length < 2 || !hasTimes(points)) return [];
  const out: SeriesPoint[] = [];
  let cumDist = 0;
  let winMeters = 0;
  let winStartT = points[0].t as number;
  for (let i = 1; i < points.length; i += 1) {
    const d = metersBetween(points[i - 1], points[i]);
    if (!Number.isFinite(d) || d <= 0) continue;
    cumDist += d;
    winMeters += d;
    if (winMeters >= windowMeters) {
      const seconds = ((points[i].t as number) - winStartT) / 1000;
      if (seconds > 0) {
        const pace = (seconds / winMeters) * 1000;
        // Clamp absurd values (GPS stalls) to keep the chart readable.
        if (pace > 0 && pace < 1800) out.push({ distanceKm: cumDist / 1000, value: pace });
      }
      winMeters = 0;
      winStartT = points[i].t as number;
    }
  }
  return downsampleSeries(out, maxPoints);
}

function downsampleSeries(series: SeriesPoint[], maxPoints: number): SeriesPoint[] {
  if (series.length <= maxPoints) return series;
  const step = Math.ceil(series.length / maxPoints);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < series.length; i += step) out.push(series[i]);
  if (out[out.length - 1] !== series[series.length - 1]) out.push(series[series.length - 1]);
  return out;
}

// Rough calorie estimate: MET-based on running pace. weightKg defaults to 70 if unknown.
export function estimateCalories(distanceKm: number, movingSeconds: number, weightKg: number | null | undefined): number | null {
  if (!distanceKm || distanceKm <= 0 || !movingSeconds || movingSeconds <= 0) return null;
  const weight = weightKg && weightKg > 0 ? weightKg : 70;
  const speedKmh = distanceKm / (movingSeconds / 3600);
  // MET approximation for running by speed (ACSM-ish): ~1 MET per km/h above rest.
  const met = Math.min(20, Math.max(6, speedKmh * 1.0 + 3.5));
  const hours = movingSeconds / 3600;
  return Math.round(met * weight * hours);
}
