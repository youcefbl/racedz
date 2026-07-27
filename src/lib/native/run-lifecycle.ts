const MAX_PLAUSIBLE_SEGMENT_SPEED_MPS = 7;
const MAX_MOVING_GAP_SECONDS = 15;

export const NON_FOOT_AUTO_PAUSE_SECONDS = 120;

export function advanceHighSpeedWindow(
  currentSeconds: number,
  segmentDistanceM: number,
  segmentDurationSeconds: number
): number {
  if (
    !Number.isFinite(segmentDistanceM) ||
    !Number.isFinite(segmentDurationSeconds) ||
    segmentDistanceM < 1 ||
    segmentDurationSeconds <= 0 ||
    segmentDurationSeconds >= MAX_MOVING_GAP_SECONDS
  ) {
    return 0;
  }

  const segmentSpeedMps = segmentDistanceM / segmentDurationSeconds;
  return segmentSpeedMps > MAX_PLAUSIBLE_SEGMENT_SPEED_MPS ? Math.max(0, currentSeconds) + segmentDurationSeconds : 0;
}

export function restoreAsPausedTiming(
  snapshot: { startTs: number; pausedAccum: number; updatedAt: number },
  now: number
): { pausedAccum: number; pauseStart: number; elapsedSec: number } {
  const safeNow = Math.max(snapshot.startTs, now);
  const safeUpdatedAt = Math.min(safeNow, Math.max(snapshot.startTs, snapshot.updatedAt));
  const offlinePausedMs = safeNow - safeUpdatedAt;
  const pausedAccum = Math.max(0, snapshot.pausedAccum) + offlinePausedMs;

  return {
    pausedAccum,
    pauseStart: safeNow,
    elapsedSec: Math.max(0, Math.floor((safeNow - snapshot.startTs - pausedAccum) / 1000))
  };
}
