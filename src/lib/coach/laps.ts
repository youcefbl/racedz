import { z } from "zod";

/**
 * Manual laps (NATRUN-06.5): the runner pressed Lap at these points of the run. Stored as bounded
 * boundaries — `{ atMeters, atSeconds }` measured from the start — never as derived rows, and
 * derived here (one helper, one set of tests) for the API and any client that needs the table.
 *
 * Automatic kilometre splits are a separate thing (run-stats.ts) and are not affected by laps.
 */

export const MAX_LAPS = 100;
/** Two presses closer than this are one press: an accidental double tap, not a lap. */
export const MIN_LAP_SECONDS = 5;
export const MIN_LAP_METERS = 5;

export type LapBoundary = { atMeters: number; atSeconds: number };

export type Lap = {
  /** 1-based. The last lap runs from the final boundary to the end of the run. */
  index: number;
  meters: number;
  seconds: number;
  paceSecondsPerKm: number | null;
};

export const lapBoundarySchema = z.object({
  atMeters: z.number().finite().min(0).max(500_000),
  atSeconds: z.number().int().min(0).max(172_800),
});

/**
 * The array as accepted on create. Ordering, spacing and range against the run's own totals are
 * checked with [validateLapBoundaries] once distance/duration are known.
 */
export const lapBoundariesSchema = z.array(lapBoundarySchema).max(MAX_LAPS);

/** Returns a message when the boundaries are not acceptable for a run of these totals, else null. */
export function validateLapBoundaries(
  laps: LapBoundary[] | null | undefined,
  totalMeters: number,
  totalSeconds: number
): string | null {
  if (!laps || laps.length === 0) return null;
  if (laps.length > MAX_LAPS) return `At most ${MAX_LAPS} laps.`;
  let prev: LapBoundary = { atMeters: 0, atSeconds: 0 };
  for (const lap of laps) {
    if (!Number.isFinite(lap.atMeters) || !Number.isInteger(lap.atSeconds)) return "Lap values must be numbers.";
    if (lap.atSeconds - prev.atSeconds < MIN_LAP_SECONDS) return "Laps must be at least a few seconds apart.";
    if (lap.atMeters - prev.atMeters < MIN_LAP_METERS) return "Laps must be at least a few metres apart.";
    // A metre of slack for rounding between the client's running total and the final distance.
    if (lap.atMeters > totalMeters + 1) return "A lap lies beyond the run's distance.";
    if (lap.atSeconds > totalSeconds) return "A lap lies beyond the run's duration.";
    prev = lap;
  }
  return null;
}

/** Derives per-lap distance, time and pace, including the final lap to the end of the run. */
export function deriveLaps(laps: LapBoundary[] | null | undefined, totalMeters: number, totalSeconds: number): Lap[] {
  if (!laps || laps.length === 0) return [];
  const out: Lap[] = [];
  let prev: LapBoundary = { atMeters: 0, atSeconds: 0 };
  const push = (index: number, to: LapBoundary) => {
    const meters = Math.max(0, to.atMeters - prev.atMeters);
    const seconds = Math.max(0, to.atSeconds - prev.atSeconds);
    out.push({
      index,
      meters,
      seconds,
      paceSecondsPerKm: meters >= MIN_LAP_METERS && seconds > 0 ? Math.round((seconds / meters) * 1000) : null,
    });
    prev = to;
  };
  laps.forEach((lap, i) => push(i + 1, lap));
  // The remainder after the last press is a lap too — the one the runner was in at Finish. Only
  // when it is more than noise; a Finish two metres after a Lap press is not a lap.
  const tail: LapBoundary = { atMeters: totalMeters, atSeconds: totalSeconds };
  if (tail.atMeters - prev.atMeters >= MIN_LAP_METERS && tail.atSeconds - prev.atSeconds >= MIN_LAP_SECONDS) {
    push(laps.length + 1, tail);
  }
  return out;
}
