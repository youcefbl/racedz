/**
 * Route segments: the hard discontinuities in a recorded route.
 *
 * A route point may carry `segment` — 0 for the first stretch, incremented by the recorder on
 * every resume (manual or automatic) and on recovery after the app was killed. Two consecutive
 * points in different segments are NOT connected: whatever happened between them (a manual pause,
 * a bus ride while paused, a dead process) is not distance, not moving time, not climb and not a
 * speed sample, and no map may draw a line across it.
 *
 * Before 2026-11-17 the field did not exist; such routes read as one segment, exactly as before.
 * The numbers themselves carry no meaning beyond "changed" — a pause with no fix before the next
 * one skips a value, and that is fine.
 *
 * Pure and dependency-free: imported by server code (distance correction, stats, GPX) and by
 * client components (maps) alike.
 */

type MaybeSegmented = { segment?: number | null } | null | undefined;

/** The segment a point belongs to; a point without one (any pre-segment route) is segment 0. */
export function routeSegment(point: MaybeSegmented): number {
  const value = point?.segment;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** True when nothing may be measured or drawn from [prev] to [cur]. */
export function isSegmentBreak(prev: MaybeSegmented, cur: MaybeSegmented): boolean {
  return routeSegment(prev) !== routeSegment(cur);
}

/** True when any point in the route marks a segment — i.e. the recorder knew about pauses. */
export function hasSegmentMarkers(points: readonly unknown[]): boolean {
  return points.some((p) => p != null && typeof p === "object" && typeof (p as { segment?: unknown }).segment === "number");
}

/** The route cut at every break, in order. Never returns empty pieces. */
export function splitRouteSegments<T extends MaybeSegmented>(points: readonly T[]): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0 && isSegmentBreak(points[i - 1], points[i]) && current.length > 0) {
      out.push(current);
      current = [];
    }
    current.push(points[i]);
  }
  if (current.length > 0) out.push(current);
  return out;
}

/**
 * Evenly-spaced subsample to about [max] points that keeps the first and last point and both
 * sides of every segment break (the last point before it and the first after), so a thinned
 * route still starts, stops and resumes where the real one did and is never drawn across a pause.
 *
 * Break points take priority over [max]: a route paused more often than [max] / 2 times comes back
 * a little larger rather than wrong.
 */
export function downsampleRoutePreservingSegments<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max || max < 2) return points.slice();
  const keep = new Set<number>([0, points.length - 1]);
  for (let i = 1; i < points.length; i += 1) {
    if (isSegmentBreak(points[i - 1] as MaybeSegmented, points[i] as MaybeSegmented)) {
      keep.add(i - 1);
      keep.add(i);
    }
  }
  const room = Math.max(0, max - keep.size);
  if (room > 0) {
    const step = points.length / room;
    for (let k = 0; k < room; k += 1) keep.add(Math.min(points.length - 1, Math.floor(k * step)));
  }
  return Array.from(keep)
    .sort((a, b) => a - b)
    .map((i) => points[i]);
}
