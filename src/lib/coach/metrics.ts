export type MetricRun = {
  startedAt: Date | string;
  distanceKm: number;
  durationSeconds: number;
  perceivedEffort: number;
  fatigueLevel: number;
  painLevel: number;
};

// How the runner's recent efforts are distributed across easy / grey-zone / hard, so the coach can
// enforce the 80/20 (polarised) principle: most running should be genuinely easy, with a little
// truly hard work. The classic amateur mistake is running easy days too hard — living in the
// moderate "grey zone" — which limits both recovery and adaptation. Effort is the runner's RPE
// (1–10), which is always recorded, so this works even without heart-rate data.
export type IntensityDistribution = {
  ratedRunCount: number;
  easyRunCount: number;
  moderateRunCount: number;
  hardRunCount: number;
  easySharePercent: number | null;
  moderateSharePercent: number | null;
  hardSharePercent: number | null;
  status: "INSUFFICIENT_DATA" | "WELL_POLARIZED" | "TOO_MUCH_GREY_ZONE" | "TOO_HARD_OVERALL";
};

// RPE thresholds: ≤4 is conversational/easy, 5–6 is the moderate grey zone to minimise, ≥7 is a
// genuinely hard session (tempo/intervals/race).
const EASY_RPE_MAX = 4;
const MODERATE_RPE_MAX = 6;
// Below a handful of runs the split is noise, so we don't nudge on intensity yet.
const MIN_RUNS_FOR_INTENSITY = 5;

export function assessIntensityDistribution(runs: MetricRun[], now = new Date()): IntensityDistribution {
  const currentTime = now.getTime();
  const rated = runs.filter((run) => {
    const time = new Date(run.startedAt).getTime();
    return (
      Number.isFinite(time) &&
      time <= currentTime &&
      time >= currentTime - 28 * DAY_MS &&
      Number.isFinite(run.perceivedEffort) &&
      run.perceivedEffort > 0
    );
  });

  const easyRunCount = rated.filter((run) => run.perceivedEffort <= EASY_RPE_MAX).length;
  const hardRunCount = rated.filter((run) => run.perceivedEffort > MODERATE_RPE_MAX).length;
  const moderateRunCount = rated.length - easyRunCount - hardRunCount;

  if (rated.length < MIN_RUNS_FOR_INTENSITY) {
    return {
      ratedRunCount: rated.length,
      easyRunCount,
      moderateRunCount,
      hardRunCount,
      easySharePercent: null,
      moderateSharePercent: null,
      hardSharePercent: null,
      status: "INSUFFICIENT_DATA"
    };
  }

  const easyShare = round((easyRunCount / rated.length) * 100);
  const moderateShare = round((moderateRunCount / rated.length) * 100);
  const hardShare = round((hardRunCount / rated.length) * 100);

  // Little easy running paired with a lot of genuinely hard work is "too hard overall" — flag that
  // first so it isn't mislabelled as a grey-zone problem. Otherwise a moderate-heavy split is the
  // classic grey-zone trap; then too little easy running generally; else it's healthy.
  const status: IntensityDistribution["status"] =
    easyShare < 50 && hardShare >= 35
      ? "TOO_HARD_OVERALL"
      : moderateShare >= 40
        ? "TOO_MUCH_GREY_ZONE"
        : easyShare < 60
          ? "TOO_HARD_OVERALL"
          : "WELL_POLARIZED";

  return {
    ratedRunCount: rated.length,
    easyRunCount,
    moderateRunCount,
    hardRunCount,
    easySharePercent: easyShare,
    moderateSharePercent: moderateShare,
    hardSharePercent: hardShare,
    status
  };
}

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

// A factual read on whether the runner is training consistently, so the coach can encourage
// getting back on track when runs are being skipped — and celebrate consistency when they aren't —
// instead of guessing. Derived from actual runs vs the days/week the runner committed to.
export type ConsistencyAssessment = {
  daysSinceLastRun: number | null;
  committedRunsPerWeek: number | null;
  runsLast7Days: number;
  runsPrevious7Days: number;
  // Shortfall against the committed cadence over the last 7 days (0 when they met or beat it).
  missedSessionsLast7Days: number | null;
  status: "NO_RUNS_YET" | "ON_TRACK" | "SLIGHTLY_BEHIND" | "FALLING_BEHIND" | "RETURNING_AFTER_BREAK";
};

// Absence this long reads as a break to return from rather than a couple of missed sessions —
// the coach should welcome the runner back and restart gently, not scold.
const RETURN_GAP_DAYS = 10;

export function assessConsistency(
  runs: MetricRun[],
  committedRunsPerWeek: number | null,
  now = new Date()
): ConsistencyAssessment {
  const currentTime = now.getTime();
  const timestamps = runs
    .map((run) => new Date(run.startedAt).getTime())
    .filter((time) => Number.isFinite(time) && time <= currentTime)
    .sort((a, b) => b - a);

  const runsLast7Days = timestamps.filter((time) => time >= currentTime - 7 * DAY_MS).length;
  const runsPrevious7Days = timestamps.filter(
    (time) => time < currentTime - 7 * DAY_MS && time >= currentTime - 14 * DAY_MS
  ).length;
  const daysSinceLastRun = timestamps.length ? Math.floor((currentTime - timestamps[0]) / DAY_MS) : null;

  // Fall back to a sensible default cadence when the runner never set training days, so the signal
  // still works. Clamp so an over-eager commitment doesn't make everyone look "behind".
  const committed = committedRunsPerWeek && committedRunsPerWeek > 0 ? committedRunsPerWeek : null;
  const expected = committed ?? 3;
  const missedSessionsLast7Days = committed ? Math.max(0, committed - runsLast7Days) : null;

  const status: ConsistencyAssessment["status"] = (() => {
    if (timestamps.length === 0) return "NO_RUNS_YET";
    if (daysSinceLastRun !== null && daysSinceLastRun >= RETURN_GAP_DAYS) return "RETURNING_AFTER_BREAK";
    const shortfall = Math.max(0, expected - runsLast7Days);
    if (shortfall === 0 && (daysSinceLastRun ?? 0) <= 3) return "ON_TRACK";
    if (shortfall >= 2 || (daysSinceLastRun ?? 0) >= 5) return "FALLING_BEHIND";
    return "SLIGHTLY_BEHIND";
  })();

  return {
    daysSinceLastRun,
    committedRunsPerWeek: committed,
    runsLast7Days,
    runsPrevious7Days,
    missedSessionsLast7Days,
    status
  };
}

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

