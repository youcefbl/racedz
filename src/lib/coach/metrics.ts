export type MetricRun = {
  startedAt: Date | string;
  distanceKm: number;
  durationSeconds: number;
  perceivedEffort: number;
  fatigueLevel: number;
  painLevel: number;
};

export type CoachMetrics = {
  runCountLast7Days: number;
  runCountLast28Days: number;
  distanceLast7DaysKm: number;
  distancePrevious7DaysKm: number;
  distanceLast28DaysKm: number;
  weeklyDistanceChangePercent: number | null;
  averagePaceLast28DaysSecondsPerKm: number | null;
  recentPaceChangePercent: number | null;
  averageEffortLast7Days: number | null;
  maximumFatigueLast7Days: number;
  maximumPainLast7Days: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateAveragePaceSecondsPerKm(distanceKm: number, durationSeconds: number) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Distance and duration must be positive numbers.");
  }

  return Math.round(durationSeconds / distanceKm);
}

/**
 * Rough running calorie estimate. Flat running burns ~1.036 kcal per kg per km; climbing adds
 * vertical work (~9.81 J per kg per m at ~25% mechanical efficiency ≈ 0.0094 kcal/kg/m).
 * Returns null when body weight is unknown.
 */
export function estimateRunCalories(input: {
  weightKg: number | null | undefined;
  distanceKm: number;
  elevationGainM?: number | null;
}): number | null {
  const { weightKg, distanceKm } = input;
  if (!weightKg || !Number.isFinite(weightKg) || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return null;
  }
  const flat = weightKg * distanceKm * 1.036;
  const climb = weightKg * Math.max(0, input.elevationGainM ?? 0) * 0.0094;
  return Math.round(flat + climb);
}

export function calculateCoachMetrics(runs: MetricRun[], now = new Date()): CoachMetrics {
  const currentTime = now.getTime();
  const normalized = runs
    .map((run) => ({ ...run, timestamp: new Date(run.startedAt).getTime() }))
    .filter((run) => Number.isFinite(run.timestamp) && run.timestamp <= currentTime);
  const last7 = normalized.filter((run) => run.timestamp >= currentTime - 7 * DAY_MS);
  const previous7 = normalized.filter((run) => run.timestamp < currentTime - 7 * DAY_MS && run.timestamp >= currentTime - 14 * DAY_MS);
  const last14 = normalized.filter((run) => run.timestamp >= currentTime - 14 * DAY_MS);
  const previous14 = normalized.filter((run) => run.timestamp < currentTime - 14 * DAY_MS && run.timestamp >= currentTime - 28 * DAY_MS);
  const last28 = normalized.filter((run) => run.timestamp >= currentTime - 28 * DAY_MS);

  const distanceLast7DaysKm = sumDistance(last7);
  const distancePrevious7DaysKm = sumDistance(previous7);
  const recentPace = weightedPace(last14);
  const previousPace = weightedPace(previous14);

  return {
    runCountLast7Days: last7.length,
    runCountLast28Days: last28.length,
    distanceLast7DaysKm: round(distanceLast7DaysKm),
    distancePrevious7DaysKm: round(distancePrevious7DaysKm),
    distanceLast28DaysKm: round(sumDistance(last28)),
    weeklyDistanceChangePercent:
      distancePrevious7DaysKm > 0 ? round(((distanceLast7DaysKm - distancePrevious7DaysKm) / distancePrevious7DaysKm) * 100) : null,
    averagePaceLast28DaysSecondsPerKm: weightedPace(last28),
    recentPaceChangePercent:
      recentPace !== null && previousPace !== null ? round(((recentPace - previousPace) / previousPace) * 100) : null,
    averageEffortLast7Days: last7.length > 0 ? round(last7.reduce((total, run) => total + run.perceivedEffort, 0) / last7.length) : null,
    maximumFatigueLast7Days: Math.max(0, ...last7.map((run) => run.fatigueLevel)),
    maximumPainLast7Days: Math.max(0, ...last7.map((run) => run.painLevel))
  };
}

function sumDistance(runs: Array<MetricRun & { timestamp: number }>) {
  return runs.reduce((total, run) => total + run.distanceKm, 0);
}

function weightedPace(runs: Array<MetricRun & { timestamp: number }>) {
  const distance = sumDistance(runs);
  if (distance <= 0) return null;
  return Math.round(runs.reduce((total, run) => total + run.durationSeconds, 0) / distance);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

