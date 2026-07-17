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
