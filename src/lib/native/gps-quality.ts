// Centralized recording-quality rules. Keep these independent of Capacitor so the
// exact acceptance behavior can be regression-tested without a native device.

export const MAX_RECORDING_ACCURACY_M = 25;
export const MIN_MOVING_SPEED_MPS = 0.4;
export const SPEEDLESS_STARTUP_SETTLE_SECONDS = 15;

export function isUsableGpsFix(accuracyM: number | null | undefined): boolean {
  return accuracyM == null || (Number.isFinite(accuracyM) && accuracyM >= 0 && accuracyM <= MAX_RECORDING_ACCURACY_M);
}

type GpsSegment = {
  distanceM: number;
  elapsedSeconds: number;
  reportedSpeedMps: number | null | undefined;
  recordingAgeSeconds: number;
};

export function shouldCountGpsSegment(segment: GpsSegment): boolean {
  const { distanceM, elapsedSeconds, reportedSpeedMps, recordingAgeSeconds } = segment;
  if (!Number.isFinite(distanceM) || distanceM < 1 || distanceM > 60) return false;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return false;

  if (reportedSpeedMps != null && Number.isFinite(reportedSpeedMps)) {
    return reportedSpeedMps >= MIN_MOVING_SPEED_MPS;
  }

  // Some providers omit speed during acquisition. Avoid turning the initial position
  // convergence into distance, then retain the previous displacement fallback so older
  // devices can still record after GPS has settled.
  return recordingAgeSeconds >= SPEEDLESS_STARTUP_SETTLE_SECONDS;
}
