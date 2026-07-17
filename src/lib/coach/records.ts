// Personal records & streaks — pure computation over a runner's logged runs.
// No new data is stored: everything here is derived from `RunnerRun` rows the app already has.
// Used to surface a "you're making progress" summary on the Runs screen, which gives runners a
// reason to open the app between races (the biggest retention gap in the product review).

export type RecordRun = {
  id: string;
  startedAt: Date | string;
  distanceKm: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number;
};

// A single personal-best entry. `atRunId`/`achievedAt` let the UI link back to the run that set it.
export type PersonalRecord = {
  seconds: number; // for distance PRs: the (estimated) time; for pace PR: seconds per km
  atRunId: string;
  achievedAt: Date;
};

export type PersonalRecords = {
  totalRuns: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  longestRunKm: number;
  longestRunAt: Date | null;
  longestRunId: string | null;
  fastestPace: PersonalRecord | null; // best average pace over any run >= 1 km
  best5k: PersonalRecord | null; // estimated best 5 km time (runs that covered >= 5 km)
  best10k: PersonalRecord | null; // estimated best 10 km time (runs that covered >= 10 km)
  currentStreakWeeks: number;
  longestStreakWeeks: number;
  // How many runs actually *covered* each landmark distance. These count completions, so a runner
  // who has never gone the distance sits at a true 0 — unlike a longest-run-vs-threshold ratio,
  // which reads as "5 of 42 marathons" when it means "5 km of the 42.2 km you need".
  runsAt10k: number;
  runsAtHalf: number;
  runsAtMarathon: number;
};

// Pace PRs need a fairness floor so a 200 m sprint can't set an all-time pace record.
const MIN_PACE_DISTANCE_KM = 1;

// Official IAAF distances. A run counts only once it covers the real distance — no GPS-shortfall
// tolerance, so the badge means what it says.
const TEN_K_KM = 10;
const HALF_MARATHON_KM = 21.0975;
const MARATHON_KM = 42.195;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

// Best (fastest) average pace among runs that covered at least `minKm`, expressed as an
// estimated time for `distanceKm` (pace × distance). This is an *estimate* — true splits would
// need per-km data — but it's an honest, monotonic "best effort at this distance" signal.
function bestDistanceRecord(runs: RecordRun[], minKm: number, distanceKm: number): PersonalRecord | null {
  let best: PersonalRecord | null = null;
  for (const run of runs) {
    if (run.distanceKm < minKm || run.averagePaceSecondsPerKm <= 0) continue;
    const seconds = Math.round(run.averagePaceSecondsPerKm * distanceKm);
    if (!best || seconds < best.seconds) {
      best = { seconds, atRunId: run.id, achievedAt: toDate(run.startedAt) };
    }
  }
  return best;
}

// Monday-anchored week key ("YYYY-Www"-ish integer): the number of whole weeks since the Unix
// epoch Monday. Two runs share a key iff they fall in the same Mon–Sun week (UTC).
function weekIndex(date: Date): number {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  // The Unix epoch (1970-01-01) was a Thursday; shift back 3 days so weeks start on Monday.
  return Math.floor((date.getTime() + 3 * 24 * 60 * 60 * 1000) / MS_PER_WEEK);
}

function computeStreaks(runs: RecordRun[], now: Date): { current: number; longest: number } {
  if (runs.length === 0) return { current: 0, longest: 0 };
  const weeks = new Set(runs.map((run) => weekIndex(toDate(run.startedAt))));

  // Longest run of consecutive active weeks anywhere in history.
  const sorted = [...weeks].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  // Current streak: walk back from this week. Allow a one-week grace so the streak doesn't read
  // as "0" early in a week before the runner has gone out yet — anchor on this week if it has a
  // run, otherwise on last week.
  const thisWeek = weekIndex(now);
  let anchor = weeks.has(thisWeek) ? thisWeek : weeks.has(thisWeek - 1) ? thisWeek - 1 : null;
  let current = 0;
  while (anchor !== null && weeks.has(anchor)) {
    current += 1;
    anchor -= 1;
  }

  return { current, longest };
}

export function computePersonalRecords(runs: RecordRun[], now: Date = new Date()): PersonalRecords {
  let totalDistanceKm = 0;
  let totalDurationSeconds = 0;
  let longestRunKm = 0;
  let longestRunAt: Date | null = null;
  let longestRunId: string | null = null;
  let fastestPace: PersonalRecord | null = null;
  let runsAt10k = 0;
  let runsAtHalf = 0;
  let runsAtMarathon = 0;

  for (const run of runs) {
    totalDistanceKm += run.distanceKm;
    totalDurationSeconds += run.durationSeconds;
    if (run.distanceKm > longestRunKm) {
      longestRunKm = run.distanceKm;
      longestRunAt = toDate(run.startedAt);
      longestRunId = run.id;
    }
    if (run.distanceKm >= TEN_K_KM) runsAt10k += 1;
    if (run.distanceKm >= HALF_MARATHON_KM) runsAtHalf += 1;
    if (run.distanceKm >= MARATHON_KM) runsAtMarathon += 1;
    if (run.distanceKm >= MIN_PACE_DISTANCE_KM && run.averagePaceSecondsPerKm > 0) {
      if (!fastestPace || run.averagePaceSecondsPerKm < fastestPace.seconds) {
        fastestPace = { seconds: run.averagePaceSecondsPerKm, atRunId: run.id, achievedAt: toDate(run.startedAt) };
      }
    }
  }

  const { current, longest } = computeStreaks(runs, now);

  return {
    totalRuns: runs.length,
    totalDistanceKm,
    totalDurationSeconds,
    longestRunKm,
    longestRunAt,
    longestRunId,
    fastestPace,
    best5k: bestDistanceRecord(runs, 5, 5),
    best10k: bestDistanceRecord(runs, 10, 10),
    currentStreakWeeks: current,
    longestStreakWeeks: longest,
    runsAt10k,
    runsAtHalf,
    runsAtMarathon
  };
}
