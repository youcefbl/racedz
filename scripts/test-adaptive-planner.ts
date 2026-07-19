import { buildAdaptivePlan } from "@/lib/coach/adaptive-planner";
import { calculateCoachMetrics, type CoachMetrics } from "@/lib/coach/metrics";
import { localizeWorkout } from "@/lib/coach/workout-i18n";

// Deterministic checks on the adaptive planner. No network, no DB — the planner is a pure function,
// so every assertion here is reproducible.

const NOW = new Date("2026-07-18T09:00:00.000Z");
let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) passed += 1;
  else failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
}

// Build metrics from synthetic runs so the metric shape always matches production.
function metricsFrom(runs: Array<{ daysAgo: number; distanceKm: number }>, over: Partial<CoachMetrics> = {}): CoachMetrics {
  const base = calculateCoachMetrics(
    runs.map((r, i) => ({
      id: `r${i}`,
      startedAt: new Date(NOW.getTime() - r.daysAgo * 86_400_000).toISOString(),
      distanceKm: r.distanceKm,
      durationSeconds: Math.round(r.distanceKm * 330),
      perceivedEffort: 5, fatigueLevel: 4, painLevel: 0,
      averagePaceSecondsPerKm: 330, elevationGainM: 20,
      averageHeartRate: 150, avgCadence: 172, symptoms: null, notes: null
    })),
    NOW
  );
  return { ...base, ...over };
}

const HALF_PLAN = {
  goalType: "HALF_MARATHON" as const,
  experienceLevel: "INTERMEDIATE" as const,
  targetDate: new Date("2026-09-27T00:00:00.000Z"),
  targetDistanceKm: 21.1,
  currentWeeklyDistanceKm: 40,
  peakWeeklyDistanceKm: 55,
  availableTrainingDays: [0, 1, 2, 4, 6],
  preferredLongRunDay: 0
};

// ── The regression this file exists for ──────────────────────────────────────
// longestRecentRunKm is frozen at goal creation. A runner who has since built up to 18 km must not be
// capped at their onboarding 10 km — otherwise long runs stall for the whole training block.
{
  const grown = [18, 16, 15, 14].map((distanceKm, i) => ({ daysAgo: i * 7 + 1, distanceKm }));
  const withHistory = buildAdaptivePlan({ ...HALF_PLAN, longestRecentRunKm: 10, metrics: metricsFrom(grown) }, NOW);
  const stale = buildAdaptivePlan(
    { ...HALF_PLAN, longestRecentRunKm: 10, metrics: metricsFrom(grown, { longestRunLast28DaysKm: null }) },
    NOW
  );
  check(
    "long-run cap follows actual recent longest, not the frozen onboarding value",
    withHistory.longRunKm > stale.longRunKm,
    `withHistory=${withHistory.longRunKm} stale=${stale.longRunKm}`
  );
  check(
    "cap stays within +10% (+1km) of the real longest run",
    withHistory.longRunKm <= 18 * 1.1 + 1.001,
    `longRunKm=${withHistory.longRunKm}`
  );
}

// A runner with no recent history still falls back to the onboarding value rather than going uncapped.
{
  const plan = buildAdaptivePlan({ ...HALF_PLAN, longestRecentRunKm: 12, metrics: metricsFrom([]) }, NOW);
  check("falls back to onboarding longest when there is no run history", plan.longRunKm <= 12 * 1.1 + 1.001, `longRunKm=${plan.longRunKm}`);
}

// ── Core invariants ──────────────────────────────────────────────────────────
{
  const runs = [10, 8, 12, 7, 9].map((distanceKm, i) => ({ daysAgo: i * 3 + 1, distanceKm }));
  const plan = buildAdaptivePlan({ ...HALF_PLAN, longestRecentRunKm: 14, metrics: metricsFrom(runs) }, NOW);

  check("long run never exceeds half the weekly volume", plan.longRunKm <= plan.weeklyVolumeKm * 0.5 + 0.001);
  check("only runs on days the runner is available", plan.workouts.every((w) => HALF_PLAN.availableTrainingDays.includes(new Date(w.scheduledFor).getUTCDay())));
  check("exactly one long run per week", plan.workouts.filter((w) => w.workoutType === "LONG_RUN").length === 1);
  check("every workout carries a positive distance target", plan.workouts.every((w) => (w.targetDistanceKm ?? 0) > 0));

  // Quality sessions must be spaced — never back-to-back, never the day before the long run.
  const days = plan.workouts.map((w) => ({ type: w.workoutType, t: new Date(w.scheduledFor).getTime() })).sort((a, b) => a.t - b.t);
  const isQuality = (t: string) => t === "TEMPO" || t === "INTERVAL";
  let backToBack = false;
  let dayBeforeLong = false;
  for (let i = 0; i < days.length - 1; i += 1) {
    const gap = days[i + 1].t - days[i].t;
    if (gap <= 86_400_000 && isQuality(days[i].type) && isQuality(days[i + 1].type)) backToBack = true;
    if (gap <= 86_400_000 && isQuality(days[i].type) && days[i + 1].type === "LONG_RUN") dayBeforeLong = true;
  }
  check("no back-to-back quality sessions", !backToBack);
  check("no quality session the day before the long run", !dayBeforeLong);
}

// Safety reductions must actually reduce load, and be explained.
{
  const runs = [10, 8, 12, 7, 9].map((distanceKm, i) => ({ daysAgo: i * 3 + 1, distanceKm }));
  const baseline = buildAdaptivePlan({ ...HALF_PLAN, longestRecentRunKm: 14, metrics: metricsFrom(runs) }, NOW);
  const painful = buildAdaptivePlan(
    { ...HALF_PLAN, longestRecentRunKm: 14, metrics: metricsFrom(runs, { maximumPainLast7Days: 6 }) },
    NOW
  );
  const tired = buildAdaptivePlan(
    { ...HALF_PLAN, longestRecentRunKm: 14, metrics: metricsFrom(runs, { maximumFatigueLast7Days: 9 }) },
    NOW
  );
  check("recent pain reduces weekly volume", painful.weeklyVolumeKm < baseline.weeklyVolumeKm, `${painful.weeklyVolumeKm} vs ${baseline.weeklyVolumeKm}`);
  check("pain reduction is explained in adaptations", painful.adaptations.length > 0);
  check("high fatigue reduces weekly volume", tired.weeklyVolumeKm < baseline.weeklyVolumeKm, `${tired.weeklyVolumeKm} vs ${baseline.weeklyVolumeKm}`);
  check("pain reduces load more than fatigue does", painful.weeklyVolumeKm < tired.weeklyVolumeKm);
}

// Experience ceilings hold even for an over-eager profile.
{
  const huge = Array.from({ length: 20 }, (_, i) => ({ daysAgo: i + 1, distanceKm: 20 }));
  const beginner = buildAdaptivePlan(
    { ...HALF_PLAN, experienceLevel: "BEGINNER", currentWeeklyDistanceKm: 200, peakWeeklyDistanceKm: 200, longestRecentRunKm: 30, metrics: metricsFrom(huge) },
    NOW
  );
  check("beginner weekly volume respects the 45 km ceiling", beginner.weeklyVolumeKm <= 45.001, `weeklyVolumeKm=${beginner.weeklyVolumeKm}`);
  check("beginner runs at most 4 days", new Set(beginner.workouts.map((w) => w.scheduledFor)).size <= 4);
}

// The target date drives periodization.
{
  const runs = [10, 8, 12].map((distanceKm, i) => ({ daysAgo: i * 3 + 1, distanceKm }));
  const phaseAt = (weeksOut: number) =>
    buildAdaptivePlan(
      { ...HALF_PLAN, targetDate: new Date(NOW.getTime() + weeksOut * 7 * 86_400_000), longestRecentRunKm: 14, metrics: metricsFrom(runs) },
      NOW
    );
  check("2 weeks out tapers", phaseAt(2).phase === "TAPER", phaseAt(2).phase);
  check("4 weeks out peaks", phaseAt(4).phase === "PEAK", phaseAt(4).phase);
  check("8 weeks out builds", phaseAt(8).phase === "BUILD", phaseAt(8).phase);
  check("16 weeks out stays in base", phaseAt(16).phase === "BASE", phaseAt(16).phase);
  check("taper shortens the long run", phaseAt(2).longRunKm < phaseAt(8).longRunKm);
}

// ── Pace targets (#3) ────────────────────────────────────────────────────────
{
  // ~5:30/km average across recent runs.
  const runs = [10, 8, 12, 7, 9].map((distanceKm, i) => ({ daysAgo: i * 3 + 1, distanceKm }));
  const m = metricsFrom(runs);
  const plan = buildAdaptivePlan({ ...HALF_PLAN, longestRecentRunKm: 14, metrics: m }, NOW);
  const ref = m.averagePaceLast28DaysSecondsPerKm;

  check("a reference pace is available for this fixture", ref !== null);
  check("every session carries a pace target when a reference pace exists", plan.workouts.every((w) => w.targetPaceSecondsPerKm !== null));

  const easy = plan.workouts.find((w) => w.workoutType === "EASY");
  const long = plan.workouts.find((w) => w.workoutType === "LONG_RUN");
  const quality = plan.workouts.find((w) => w.workoutType === "TEMPO" || w.workoutType === "INTERVAL");
  check("easy pace is slower than recent average", (easy?.targetPaceSecondsPerKm ?? 0) > (ref ?? 0), `easy=${easy?.targetPaceSecondsPerKm} ref=${ref}`);
  check("long-run pace is slower than recent average", (long?.targetPaceSecondsPerKm ?? 0) > (ref ?? 0));
  check("quality pace is faster than recent average", (quality?.targetPaceSecondsPerKm ?? Infinity) < (ref ?? 0), `quality=${quality?.targetPaceSecondsPerKm} ref=${ref}`);
  check("easy is slower than quality", (easy?.targetPaceSecondsPerKm ?? 0) > (quality?.targetPaceSecondsPerKm ?? 0));

  // No history → no reference → no invented pace targets.
  const noHistory = buildAdaptivePlan({ ...HALF_PLAN, longestRecentRunKm: 12, metrics: metricsFrom([]) }, NOW);
  check("no pace targets are invented without a reference pace", noHistory.workouts.every((w) => w.targetPaceSecondsPerKm === null));

  // An absurd reference (GPS glitch / walk) must not produce an absurd prescription.
  const absurd = buildAdaptivePlan(
    { ...HALF_PLAN, longestRecentRunKm: 14, metrics: metricsFrom(runs, { averagePaceLast28DaysSecondsPerKm: 4000 }) },
    NOW
  );
  check("an implausible reference pace yields no target rather than a nonsense one", absurd.workouts.every((w) => w.targetPaceSecondsPerKm === null));
}

// ── Beginner quality is strides, not intervals (#4) ──────────────────────────
{
  // A beginner needs to be past BASELINE to get any quality at all, so use a BUILD-phase 5K profile.
  const runs = [4, 3, 5, 4].map((distanceKm, i) => ({ daysAgo: i * 2 + 1, distanceKm }));
  const beginner = buildAdaptivePlan(
    {
      ...HALF_PLAN,
      goalType: "FIVE_K",
      experienceLevel: "BEGINNER",
      targetDistanceKm: 5,
      targetDate: new Date(NOW.getTime() + 8 * 7 * 86_400_000),
      currentWeeklyDistanceKm: 16,
      peakWeeklyDistanceKm: 20,
      longestRecentRunKm: 5,
      metrics: metricsFrom(runs)
    },
    NOW
  );
  check("beginner is past baseline and gets a quality session", beginner.qualitySessions >= 1, `phase=${beginner.phase} quality=${beginner.qualitySessions}`);
  check("beginner never gets structured intervals", !beginner.workouts.some((w) => w.workoutType === "INTERVAL"));
  check("beginner quality is an easy run with strides", beginner.workouts.some((w) => w.title.includes("strides")));

  // The same 5K goal at intermediate level still gets true intervals.
  const intermediate = buildAdaptivePlan(
    {
      ...HALF_PLAN,
      goalType: "FIVE_K",
      experienceLevel: "INTERMEDIATE",
      targetDistanceKm: 5,
      targetDate: new Date(NOW.getTime() + 8 * 7 * 86_400_000),
      longestRecentRunKm: 14,
      metrics: metricsFrom([10, 8, 12, 7, 9].map((distanceKm, i) => ({ daysAgo: i * 3 + 1, distanceKm })))
    },
    NOW
  );
  check("an intermediate 5K runner still gets real intervals", intermediate.workouts.some((w) => w.workoutType === "INTERVAL"));
  check("strides are stored as an EASY workout type", beginner.workouts.filter((w) => w.title.includes("strides")).every((w) => w.workoutType === "EASY"));
}

// ── Localization of planner output ───────────────────────────────────────────
// The planner emits English strings and composite "Phase · Title" headings. Without translation a
// French or Arabic runner reads an English plan, so every generated string must localize.
{
  const runs = [10, 8, 12, 7, 9].map((distanceKm, i) => ({ daysAgo: i * 3 + 1, distanceKm }));
  const plan = buildAdaptivePlan({ ...HALF_PLAN, longestRecentRunKm: 14, metrics: metricsFrom(runs) }, NOW);

  for (const locale of ["fr", "ar"] as const) {
    const localized = plan.workouts.map((w) => localizeWorkout(w, locale));
    check(
      `${locale}: no workout title is left in English`,
      localized.every((w) => !/Long run|Easy run|Tempo run|Intervals|Recovery jog/.test(w.title)),
      localized.map((w) => w.title).join(" | ")
    );
    // The fixture is a BASE-phase plan. Assert the prefix is the expected localized term rather than
    // "not an English word": "Base" is legitimately spelled the same in French, so a regex over English
    // vocabulary would fail on correct output.
    const expectedPrefix = { fr: "Base", ar: "بناء القاعدة" }[locale];
    check(
      `${locale}: the training-phase prefix is the expected localized term`,
      localized.every((w) => w.title.startsWith(`${expectedPrefix} · `)),
      localized.map((w) => w.title).join(" | ")
    );
    check(`${locale}: intensity is translated`, localized.every((w) => !/Comfortable|Relaxed|Hard efforts|Very easy/.test(w.intensity)));
    check(`${locale}: instructions are translated`, localized.every((w) => !/^Keep it easy|^Fully conversational|^After an easy warm-up|^Warm up well|^Gentle and short/.test(w.instructions)));
    check(`${locale}: pace targets survive localization`, localized.every((w, i) => w.targetPaceSecondsPerKm === plan.workouts[i].targetPaceSecondsPerKm));
  }
}

console.log(`adaptive planner: ${passed}/${passed + failures.length} checks passed`);
if (failures.length > 0) {
  console.error("\nFAILED:");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exitCode = 1;
}
