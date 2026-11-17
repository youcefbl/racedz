// Detects when a "run" was almost certainly recorded on wheels or a motor (car, bike,
// scooter, skateboard, e-bike, …) rather than on foot, so we can warn the runner instead
// of silently logging it as a run. Two independent signals, either of which is enough:
//
//   1. cadence — the step rate is far too low for the ground covered. On foot, any
//      jog-or-faster speed forces a cadence well above ~120 spm; a single/low-double-digit
//      spm at real speed is impossible without wheels. (Needs the step sensor, so this
//      only fires on GPS runs recorded on the phone, where avgCadence is known.)
//   2. speed — the average pace is faster than a human can run on foot. This needs no
//      step data, so it also catches imported GPX rides with no cadence at all.
//
// Pure and side-effect free; safe to call from client components on every render.

export type NonFootReason = "cadence" | "speed";

// Below this cadence, while genuinely moving at speed, footfalls can't explain the
// distance covered. Brisk walking is ~110-120 spm and easy jogging ~150+.
const MIN_FOOT_CADENCE_SPM = 120;
// Only apply the cadence test above this speed — slow shuffling or standing around can
// legitimately read a low step rate.
const CADENCE_TEST_MIN_SPEED_KMH = 7; // ~8:30/km
// Faster than this average pace is beyond sustained human running (≈24 km/h), so it's
// motorized on its own regardless of whether steps were recorded.
const IMPOSSIBLE_PACE_SEC_PER_KM = 150; // 2:30/km
// Ignore tiny samples where a couple of stray GPS fixes would dominate the average.
const MIN_DISTANCE_KM = 0.5;
const MIN_MOVING_SECONDS = 90;

export function detectNonFootActivity(input: {
  distanceKm: number;
  movingSeconds: number;
  avgCadence?: number | null;
}): NonFootReason | null {
  const { distanceKm, movingSeconds } = input;
  const avgCadence = input.avgCadence ?? null;
  if (!(distanceKm >= MIN_DISTANCE_KM) || !(movingSeconds >= MIN_MOVING_SECONDS)) return null;

  const speedKmh = distanceKm / (movingSeconds / 3600);
  const paceSecPerKm = movingSeconds / distanceKm;

  // 1. Impossibly fast for a human on foot — motorized regardless of cadence.
  if (paceSecPerKm > 0 && paceSecPerKm < IMPOSSIBLE_PACE_SEC_PER_KM) return "speed";

  // 2. Moving at a genuine running speed but with a step rate too low to be footsteps.
  if (avgCadence != null && avgCadence > 0 && avgCadence < MIN_FOOT_CADENCE_SPM && speedKmh >= CADENCE_TEST_MIN_SPEED_KMH) {
    return "cadence";
  }
  return null;
}

// ---- Sport-specific plausibility (2026-11-17) -------------------------------------------------
//
// detectNonFootActivity above asks one question — "was this on foot?" — and used to be applied the
// same way to RUN, WALK and TRAIL while RIDE skipped it entirely. That let an 18 km/h "walk" save as
// a valid walk (M21 fake-GPS run) and pollute walk records. Each sport now has its own envelope.
// Nothing is ever refused or re-labelled here: the runner chose the sport, and the verdict only
// decides whether the activity feeds records, rankings, badges and the coach (VALID) or not.

export type ActivitySport = "RUN" | "WALK" | "TRAIL" | "RIDE";

export type ActivityVerdict = {
  validity: "SUSPECT" | "EXCLUDED";
  /** Stored as RunnerRun.validityReason; clients map it to copy. */
  reason: "IMPOSSIBLE_PACE" | "LOW_CADENCE_AT_SPEED" | "TOO_FAST_FOR_WALK" | "RIDE_TOO_FAST";
};

/**
 * Faster than this average is not a walk: brisk walking is 5–7 km/h and race walkers, the
 * exception, sit around 12–15 km/h. 9.5 km/h (6:19/km) is a comfortable jog.
 */
export const WALK_MAX_AVG_SPEED_KMH = 9.5;
/**
 * A ride averaging more than this is a motor vehicle. Not a peak-speed test — 45 km/h downhill is
 * a normal ride — but a sustained average that amateur cycling does not reach.
 */
export const RIDE_MAX_AVG_SPEED_KMH = 55;

/**
 * The server's verdict for a GPS activity of the given sport, or null when it is plausible.
 * Same minimum sample as detectNonFootActivity, so a few stray fixes never decide anything.
 */
export function classifyActivity(input: {
  sport: ActivitySport;
  distanceKm: number;
  movingSeconds: number;
  avgCadence?: number | null;
}): ActivityVerdict | null {
  const { sport, distanceKm, movingSeconds } = input;
  if (!(distanceKm >= MIN_DISTANCE_KM) || !(movingSeconds >= MIN_MOVING_SECONDS)) return null;
  const speedKmh = distanceKm / (movingSeconds / 3600);

  if (sport === "RIDE") {
    return speedKmh > RIDE_MAX_AVG_SPEED_KMH ? { validity: "SUSPECT", reason: "RIDE_TOO_FAST" } : null;
  }

  // RUN, TRAIL and WALK are on foot: a vehicle is a vehicle whatever it was labelled. Trail shares
  // the run rules — its slow climbs are never flagged, only the implausibly fast.
  const nonFoot = detectNonFootActivity(input);
  if (nonFoot === "speed") return { validity: "EXCLUDED", reason: "IMPOSSIBLE_PACE" };
  if (nonFoot === "cadence") return { validity: "SUSPECT", reason: "LOW_CADENCE_AT_SPEED" };

  if (sport === "WALK" && speedKmh > WALK_MAX_AVG_SPEED_KMH) return { validity: "SUSPECT", reason: "TOO_FAST_FOR_WALK" };
  return null;
}
