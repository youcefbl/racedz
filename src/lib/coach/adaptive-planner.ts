import type { PlanAdherence } from "@/lib/coach/adherence";
import type { CoachMetrics, ConsistencyAssessment } from "@/lib/coach/metrics";
import type { CoachWorkout } from "@/lib/coach/schemas";

// Deterministic adaptive planning engine (Phase 2). Produces one safe week of candidate sessions from
// the runner's full current state. The application owns dates, load progression, rest minimums,
// distance ceilings, taper boundaries, and safety reductions here; the AI only explains and personalizes
// the result. Pure and side-effect-free so it can be unit-tested and simulated across profiles.
//
// Design goals (Phase 2 exit criteria):
// - 5K / 10K / half / marathon / general-fitness / trail produce meaningfully different weeks.
// - The target date drives the training phase (base → build → peak → taper) and the workout mix.
// - Missed sessions, high fatigue, and pain reduce or ease the upcoming week.

export const ADAPTIVE_PLANNER_VERSION = 1;

export type PlanPhase = "BASELINE" | "BASE" | "BUILD" | "PEAK" | "TAPER" | "RECOVERY";

type Experience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
type GoalType = "GENERAL_FITNESS" | "FIVE_K" | "TEN_K" | "HALF_MARATHON" | "MARATHON" | "TRAIL" | "OTHER";
type QualityBias = "SPEED" | "THRESHOLD" | "MIXED" | "EASY";

// A planned session carries everything the AI schema's workout does, plus a numeric pace target the
// deterministic engine derives. Pace is deliberately NOT part of `coachWorkoutSchema`: the model does
// not invent paces, it only explains the ones computed here.
export type PlannedWorkout = CoachWorkout & { targetPaceSecondsPerKm: number | null };

export type AdaptivePlannerInput = {
  goalType: GoalType;
  experienceLevel: Experience;
  targetDate: Date;
  targetDistanceKm: number | null;
  currentWeeklyDistanceKm: number;
  peakWeeklyDistanceKm: number | null;
  longestRecentRunKm: number | null;
  availableTrainingDays: number[]; // 0 = Sunday … 6 = Saturday
  preferredLongRunDay: number | null;
  metrics: CoachMetrics;
  adherence?: PlanAdherence | null;
  // Distinguishes a runner who has never logged a run from one returning after time off. The 28-day
  // metrics window cannot tell these apart — both show zero recent runs — but the difference decides
  // whether "welcome back" or "let's get started" is the true thing to say.
  consistencyStatus?: ConsistencyAssessment["status"] | null;
  // Age in years, from the account's date of birth. Null when it was never supplied — every rule
  // below then leaves the plan exactly as it was, so a missing birthday costs nothing.
  age?: number | null;
  // From the goal's own weight and height, both of which onboarding already collects. Null unless
  // both are present: a BMI guessed from weight alone would be a fabricated health number.
  bmi?: number | null;
};

export type AdaptivePlan = {
  phase: PlanPhase;
  weeksToRace: number;
  weeklyVolumeKm: number;
  longRunKm: number;
  qualitySessions: number;
  // Deterministic, human-readable notes on why load was adjusted (fed to the change summary + AI context).
  adaptations: string[];
  workouts: PlannedWorkout[];
};

// Session kinds are richer than the stored workout type: STRIDES is stored as an EASY run (it is an
// easy run with short pickups) but reads and paces differently, which is what lets a beginner get a
// gentle first taste of speed instead of structured intervals.
type SessionKind = "LONG_RUN" | "TEMPO" | "INTERVAL" | "EASY" | "RECOVERY" | "STRIDES" | "WALK_RUN";

const KIND_TO_TYPE: Record<SessionKind, CoachWorkout["workoutType"]> = {
  LONG_RUN: "LONG_RUN",
  TEMPO: "TEMPO",
  INTERVAL: "INTERVAL",
  EASY: "EASY",
  RECOVERY: "RECOVERY",
  STRIDES: "EASY",
  // Stored as EASY for the same reason STRIDES is: the schema's workout types describe running
  // intensity, and adding a WALK type would ripple through the native app, the website, and three
  // translation tables. The title and instructions carry the distinction where the runner reads it.
  WALK_RUN: "EASY"
};

// Pace targets are derived from the runner's own recent average pace, as a multiplier per session kind
// (>1 = slower than average, <1 = faster). Anchoring on actual running — rather than on goal race pace —
// means a runner with no history simply gets no pace target instead of an invented one.
const PACE_FACTOR: Record<SessionKind, number> = {
  RECOVERY: 1.18,
  EASY: 1.1,
  STRIDES: 1.1, // the easy portion; the pickups themselves are by feel, not by pace
  LONG_RUN: 1.08,
  TEMPO: 0.93,
  INTERVAL: 0.88,
  // Duration only — see derivePace(). A walk-run alternates two speeds, so its average is a way to
  // estimate how long the session takes, never a pace to hold.
  WALK_RUN: 1.35
};

// Sanity rails so a corrupt or freak average (a walk, a GPS glitch) can never yield an absurd target.
const MIN_PACE_SECONDS_PER_KM = 150; // 2:30/km — faster than any recreational target
const MAX_PACE_SECONDS_PER_KM = 900; // 15:00/km — slower than a walk-run

// Derive a numeric pace target (seconds per km) for a session, or null when there is no trustworthy
// reference pace to derive it from.
function derivePace(kind: SessionKind, referencePaceSecondsPerKm: number | null): number | null {
  // A walk-run has no single pace to aim at. Publishing the blended average as a target would tell
  // someone to walk their walking intervals at a running pace, which is the opposite of the point.
  if (kind === "WALK_RUN") return null;
  if (referencePaceSecondsPerKm === null) return null;
  if (referencePaceSecondsPerKm < MIN_PACE_SECONDS_PER_KM || referencePaceSecondsPerKm > MAX_PACE_SECONDS_PER_KM) return null;
  const target = referencePaceSecondsPerKm * PACE_FACTOR[kind];
  return Math.round(clamp(target, MIN_PACE_SECONDS_PER_KM, MAX_PACE_SECONDS_PER_KM));
}

// Hard weekly-volume ceilings (km) — the planner never exceeds these regardless of inputs.
const WEEKLY_CEILING: Record<Experience, number> = { BEGINNER: 45, INTERMEDIATE: 90, ADVANCED: 150 };
// Floors so a generated week is never trivially small.
const WEEKLY_FLOOR: Record<Experience, number> = { BEGINNER: 8, INTERMEDIATE: 15, ADVANCED: 25 };
// Rest matters more for beginners: cap how many days a week actually carry a run.
const MAX_RUN_DAYS: Record<Experience, number> = { BEGINNER: 4, INTERMEDIATE: 6, ADVANCED: 7 };

// ---- Age and body-composition load rules (COACHPAR-004, owner decision 2026-08-16) --------------
//
// Onboarding already collects date of birth, weight and height, and the AI prose was already using
// all three — so a 68-year-old read age-aware *advice* attached to the same seven-day zero-rest week
// a 24-year-old got. These rules put the same facts into the schedule.
//
// Every rule below can only make a week EASIER: each is a cap or a reduction, never an increase.
// That is deliberate. These are population heuristics applied to an individual, so the failure
// direction has to be under-prescription — a runner who is fitter than their band assumes loses a
// little progress, while the reverse risks injuring the exact people least able to absorb it.
//
// A missing value disables its own rule rather than guessing a default.

/**
 * Running days a week by age band — recovery between hard days lengthens with age, so the cap is on
 * frequency rather than on any single session. Applied as a ceiling alongside the experience cap, so
 * a 72-year-old advanced runner gets 4 running days, not 7.
 */
const AGE_RUN_DAY_CAPS: ReadonlyArray<{ fromAge: number; cap: number }> = [
  { fromAge: 70, cap: 4 },
  { fromAge: 60, cap: 5 },
  { fromAge: 50, cap: 6 }
];

/**
 * BMI at or above this is treated as joint-protective territory.
 *
 * 30 rather than the 25 that clinically reads as "overweight": BMI does not distinguish muscle from
 * fat, and a great many perfectly healthy runners sit in the 25–27 band. 30 is also already this
 * product's threshold for heavy-weight coaching tips (`isHeavyWeight`, src/lib/coach/tips.ts), so
 * the plan and the tips now agree instead of contradicting each other.
 */
const JOINT_PROTECTIVE_BMI = 30;

/** Below this, a beginner is eased in but still running; at or above it they start on walk-runs. */
const WALK_RUN_BMI = 30;

/** How the runner's age and body composition change the week. All fields are reductions. */
type LoadProfile = {
  /** Ceiling on running days, or null when nothing constrains it. */
  runDayCap: number | null;
  /** Multiplier on weekly volume. */
  volumeMultiplier: number;
  /** Quality sessions removed from whatever the phase would otherwise carry. */
  qualityReduction: number;
  /** Hard ceiling on quality sessions, or null when only the reduction applies. */
  qualityCap: number | null;
  /** True when repeated hard impact is off the table — intervals become tempo. */
  lowImpact: boolean;
  /** True when easy running is replaced by walk-run intervals. */
  walkRun: boolean;
  /**
   * Smallest long run and smallest easy session this profile will prescribe.
   *
   * These have to be part of the profile rather than fixed constants, because at the volumes a
   * beginner actually starts at the FLOORS decide the week, not the budget. With a 4.1 km budget a
   * flat 4 km long-run floor plus three 2 km floors prescribes 10 km — so a "-15% volume" reduction
   * changed the number reported to the runner and not one metre of what they were asked to run.
   */
  longRunFloorKm: number;
  easyFloorKm: number;
};

function resolveLoadProfile(input: AdaptivePlannerInput, adaptations: string[]): LoadProfile {
  const age = input.age ?? null;
  const bmi = input.bmi ?? null;
  const exp = input.experienceLevel;

  const ageCap = age === null ? null : (AGE_RUN_DAY_CAPS.find((band) => age >= band.fromAge)?.cap ?? null);
  if (ageCap !== null && ageCap < MAX_RUN_DAYS[exp]) {
    adaptations.push(`Running days capped at ${ageCap} to leave more recovery between sessions.`);
  }
  // Older runners also lose one quality session: it is the repeated hard efforts, not the easy
  // volume, that need the longer recovery the frequency cap is already making room for.
  const ageQualityReduction = age !== null && age >= 60 ? 1 : 0;

  const jointProtective = bmi !== null && bmi >= JOINT_PROTECTIVE_BMI;
  const walkRun = jointProtective && bmi >= WALK_RUN_BMI && exp === "BEGINNER";

  if (walkRun) {
    adaptations.push("Starting with walk-run intervals rather than continuous running, to build up with less impact.");
  } else if (jointProtective) {
    adaptations.push("Impact kept lower this week: easier volume and no hard interval session.");
  }

  return {
    runDayCap: jointProtective ? Math.min(ageCap ?? 5, 5) : ageCap,
    volumeMultiplier: jointProtective ? 0.85 : 1,
    qualityReduction: ageQualityReduction + (jointProtective ? 1 : 0),
    // Someone starting on walk-runs has no business doing a tempo session in the same week.
    qualityCap: walkRun ? 0 : null,
    lowImpact: jointProtective,
    walkRun,
    // Lowered together with the volume, so the reduction survives contact with the floors. Walk-run
    // goes lowest of the three: it covers less ground per minute than running, so holding it to a
    // running distance floor would silently make it the LONGEST session of the week by time.
    longRunFloorKm: walkRun ? 2.5 : jointProtective ? 3 : 4,
    easyFloorKm: walkRun ? 1.5 : jointProtective ? 1.5 : 2
  };
}

// Per-goal shape: how long the long run leans, what quality work dominates, and a volume multiplier
// (marathoners carry more; 5K/fitness less). This is the main source of "different goals → different plans".
const GOAL_PARAMS: Record<GoalType, { longShare: number; qualityBias: QualityBias; volumeMult: number; longRunCapKm: number }> = {
  FIVE_K: { longShare: 0.25, qualityBias: "SPEED", volumeMult: 0.9, longRunCapKm: 16 },
  TEN_K: { longShare: 0.28, qualityBias: "MIXED", volumeMult: 1.0, longRunCapKm: 20 },
  HALF_MARATHON: { longShare: 0.33, qualityBias: "THRESHOLD", volumeMult: 1.1, longRunCapKm: 28 },
  MARATHON: { longShare: 0.38, qualityBias: "THRESHOLD", volumeMult: 1.25, longRunCapKm: 36 },
  TRAIL: { longShare: 0.36, qualityBias: "MIXED", volumeMult: 1.15, longRunCapKm: 32 },
  GENERAL_FITNESS: { longShare: 0.3, qualityBias: "EASY", volumeMult: 0.9, longRunCapKm: 18 },
  OTHER: { longShare: 0.3, qualityBias: "MIXED", volumeMult: 1.0, longRunCapKm: 22 }
};

// Once a runner has this many logged runs in the last 28 days, their actual behaviour — not what they
// told us at onboarding — is the trustworthy read on their weekly volume.
const HISTORY_THRESHOLD_RUNS = 3;

/**
 * The weekly volume to plan from.
 *
 * `currentWeeklyDistanceKm` is captured once at goal creation and never updated, so for anyone with
 * real history it is a claim, not a measurement — and it has now produced two shipped bugs by being
 * treated as a load anchor. Prefer observed running whenever there is enough of it; fall back to the
 * stated value only for runners we have no data on.
 *
 * The 28-day average is taken alongside the last 7 days because a single quiet week would otherwise
 * ratchet the plan down sharply. Under-prescribing a runner who logs only some of their runs is the
 * safer failure direction than over-prescribing one who logs all of them.
 */
function effectiveWeeklyVolumeKm(input: AdaptivePlannerInput): number {
  const hasHistory = input.metrics.runCountLast28Days >= HISTORY_THRESHOLD_RUNS;
  if (!hasHistory) return input.currentWeeklyDistanceKm;
  return Math.max(input.metrics.distanceLast7DaysKm, input.metrics.distanceLast28DaysKm / 4);
}

export function buildAdaptivePlan(input: AdaptivePlannerInput, now = new Date()): AdaptivePlan {
  const exp = input.experienceLevel;
  const params = GOAL_PARAMS[input.goalType] ?? GOAL_PARAMS.OTHER;
  const isFitnessGoal = input.goalType === "GENERAL_FITNESS";

  const weeksToRace = weeksUntil(input.targetDate, now);
  // No runs in the last week (with little recent history) → treat as a return-to-running rebuild.
  const returning = input.metrics.runCountLast7Days === 0 && input.metrics.distanceLast28DaysKm < WEEKLY_FLOOR[exp];

  const adaptations: string[] = [];
  const load = resolveLoadProfile(input, adaptations);
  const effectiveWeeklyKm = effectiveWeeklyVolumeKm(input);
  const phase = determinePhase({ weeksToRace, exp, input, effectiveWeeklyKm, returning, isFitnessGoal, adaptations });
  // Applied after the phase's own volume maths rather than inside it, so the reduction is visible as
  // one multiplier on the finished number instead of being smeared through every branch.
  const weeklyVolumeKm = round1(
    computeWeeklyVolume({ phase, exp, params, input, effectiveWeeklyKm, returning, adaptations }) * load.volumeMultiplier
  );

  const week = buildWeek({ phase, exp, params, isFitnessGoal, weeklyVolumeKm, input, now, load });

  // Report what the week ACTUALLY prescribes, not the budget it was computed from.
  //
  // The two diverge whenever a session floor binds, which at beginner volumes is most of the time —
  // and the runner reads this number, and the plan summary quotes it ("Base week · ~45 km"). A
  // budget of 4.1 km printed over 10 km of scheduled running is not a rounding difference, it is
  // the card telling them something the plan below it contradicts.
  const prescribedVolumeKm = round1(week.workouts.reduce((total, w) => total + (w.targetDistanceKm ?? 0), 0));

  return {
    phase,
    weeksToRace,
    weeklyVolumeKm: prescribedVolumeKm,
    longRunKm: week.longRunKm,
    qualitySessions: week.qualityCount,
    adaptations,
    workouts: week.workouts
  };
}

function determinePhase({
  weeksToRace,
  exp,
  input,
  effectiveWeeklyKm,
  returning,
  isFitnessGoal,
  adaptations
}: {
  weeksToRace: number;
  exp: Experience;
  input: AdaptivePlannerInput;
  effectiveWeeklyKm: number;
  returning: boolean;
  isFitnessGoal: boolean;
  adaptations: string[];
}): PlanPhase {
  if (returning) {
    adaptations.push(
      input.consistencyStatus === "NO_RUNS_YET"
        ? "No runs logged yet — starting with easy, conservative running."
        : "Returning from a break — rebuilding with easy running."
    );
    return "BASELINE";
  }
  if (!isFitnessGoal && weeksToRace <= 0) {
    adaptations.push("Race date has passed — recovery / transition week.");
    return "RECOVERY";
  }
  // A general-fitness runner has no race clock: keep them in a sustainable base with light quality.
  if (isFitnessGoal) return "BASE";
  if (weeksToRace <= 2) return "TAPER";
  if (weeksToRace <= 4) return "PEAK";
  if (weeksToRace <= 9) return "BUILD";
  // Far out, or a beginner still building volume → base. Judged on observed volume: a beginner who
  // declared 20 km/week but runs 5 needs the baseline phase, not the extra load and quality of BASE.
  if (exp === "BEGINNER" && effectiveWeeklyKm < WEEKLY_FLOOR.BEGINNER * 1.6) return "BASELINE";
  return "BASE";
}

const PHASE_FACTOR: Record<PlanPhase, number> = {
  BASELINE: 1.0,
  BASE: 1.08,
  BUILD: 1.1,
  PEAK: 1.0,
  TAPER: 0.65,
  RECOVERY: 0.5
};

// After a long layoff, start at roughly half of what the runner used to do. Fitness comes back quickly;
// tendons, ligaments and running-specific durability do not, and that gap is where return-from-break
// injuries happen.
const RETURNING_VOLUME_SHARE = 0.55;

function computeWeeklyVolume({
  phase,
  exp,
  params,
  input,
  effectiveWeeklyKm,
  returning,
  adaptations
}: {
  phase: PlanPhase;
  exp: Experience;
  params: (typeof GOAL_PARAMS)[GoalType];
  input: AdaptivePlannerInput;
  effectiveWeeklyKm: number;
  returning: boolean;
  adaptations: string[];
}): number {
  const anchor = Math.max(effectiveWeeklyKm, WEEKLY_FLOOR[exp]);

  let volume = anchor * PHASE_FACTOR[phase] * params.volumeMult;

  // Injury-prevention: in progressing phases never jump more than ~10% over recent actual (plus a small
  // absolute allowance so a runner coming off a light week isn't frozen).
  if (phase === "BASE" || phase === "BUILD" || phase === "BASELINE") {
    // Clamp against observed volume too — reading the stated value here made the clamp toothless for
    // exactly the runners it exists to protect.
    volume = Math.min(volume, effectiveWeeklyKm * 1.1 + 3);
  }

  // Returning from a break: `currentWeeklyDistanceKm` is what the runner told us at onboarding, so on
  // its own it anchors the week to a volume they have not run in weeks — and the goal multiplier then
  // scales it *up*, handing someone back from a layoff more than they did before it. Cap hard against
  // what they used to do instead of building on it.
  if (returning) {
    const priorVolumeKm = Math.max(input.metrics.distanceLast7DaysKm, input.currentWeeklyDistanceKm);
    const capped = Math.min(volume, priorVolumeKm * RETURNING_VOLUME_SHARE);
    if (capped < volume) {
      adaptations.push(
        input.consistencyStatus === "NO_RUNS_YET"
          ? "Starting well below the weekly volume you described, until there is real running to build on."
          : "Restarting at roughly half your previous volume — fitness returns faster than tendons do."
      );
      volume = capped;
    }
  }

  // Ceilings: known peak volume, then the hard experience cap. The declared peak is also frozen at
  // onboarding, so take the best week the runner has actually run alongside it — otherwise a runner who
  // has since outgrown what they declared stays capped at it indefinitely.
  const observedPeakKm = input.metrics.bestWeeklyDistanceLast28DaysKm ?? 0;
  const knownPeakKm = Math.max(input.peakWeeklyDistanceKm ?? 0, observedPeakKm);
  volume = Math.min(volume, knownPeakKm > 0 ? knownPeakKm : WEEKLY_CEILING[exp], WEEKLY_CEILING[exp]);

  // --- Adaptation: reduce or ease the upcoming week ---
  const pain = input.metrics.maximumPainLast7Days;
  const fatigue = input.metrics.maximumFatigueLast7Days;
  const skipped = input.adherence?.skippedSessions ?? 0;
  const consecutiveMissed = input.adherence?.consecutiveMissed ?? 0;

  if (pain >= 5) {
    volume *= 0.7;
    adaptations.push("Load reduced ~30%: recent pain reported — keep it easy and reassess.");
  } else if (fatigue >= 8) {
    volume *= 0.85;
    adaptations.push("Load reduced ~15%: high fatigue in the last week.");
  }
  if (consecutiveMissed >= 2 || skipped >= 2) {
    volume *= 0.9;
    adaptations.push("Eased the week after missed sessions — no catch-up piled on.");
  }

  volume = Math.max(volume, WEEKLY_FLOOR[exp] * 0.6);
  return round1(volume);
}

function buildWeek({
  phase,
  exp,
  params,
  isFitnessGoal,
  weeklyVolumeKm,
  input,
  now,
  load
}: {
  phase: PlanPhase;
  exp: Experience;
  params: (typeof GOAL_PARAMS)[GoalType];
  isFitnessGoal: boolean;
  weeklyVolumeKm: number;
  input: AdaptivePlannerInput;
  now: Date;
  load: LoadProfile;
}): { workouts: PlannedWorkout[]; longRunKm: number; qualityCount: number } {
  const available = new Set(input.availableTrainingDays);
  const cursor = startOfUtcDay(now);
  // Training dates across the next 7 days, starting today so a same-day session still counts.
  const trainingDates: Date[] = [];
  for (let offset = 0; offset <= 6; offset += 1) {
    const date = new Date(cursor);
    date.setUTCDate(date.getUTCDate() + offset);
    if (available.has(date.getUTCDay())) trainingDates.push(date);
  }
  if (trainingDates.length === 0) return { workouts: [], longRunKm: 0, qualityCount: 0 };

  // Cap how many of the available days carry a run (rest matters, especially for beginners), then
  // apply the age/body-composition ceiling on top — whichever is tighter wins.
  // A fourth constraint the first version missed: the volume budget itself. Scheduling more days
  // than the budget can fill at the session floor does not spread the load thinner — the floors
  // simply win and the week silently prescribes far more than the budget said. Bounded below at 2
  // so a genuinely light week is still a week rather than a single session.
  const daysTheBudgetSupports = Math.max(2, Math.floor(weeklyVolumeKm / load.easyFloorKm));
  const runDayCount = Math.max(
    1,
    Math.min(
      trainingDates.length,
      MAX_RUN_DAYS[exp],
      load.runDayCap ?? Number.POSITIVE_INFINITY,
      daysTheBudgetSupports
    )
  );
  const runDates = pickRunDates(trainingDates, runDayCount, input.preferredLongRunDay);

  // Long run: a share of weekly volume, capped by recent longest (+10%), the goal cap, and shortened in taper.
  let longRunKm = weeklyVolumeKm * params.longShare;
  // Cap against the longest run the runner has *actually* done recently, falling back to the value
  // captured at onboarding. Taking the max of the two matters: the onboarding field is frozen at goal
  // creation, so on its own the cap never moves and long runs stall as the runner progresses.
  const longestActualKm = Math.max(input.longestRecentRunKm ?? 0, input.metrics.longestRunLast28DaysKm ?? 0);
  if (longestActualKm > 0) {
    longRunKm = Math.min(longRunKm, longestActualKm * 1.1 + 1);
  }
  longRunKm = Math.min(longRunKm, params.longRunCapKm);
  if (phase === "TAPER") longRunKm *= 0.7;
  if (phase === "RECOVERY" || phase === "BASELINE") longRunKm = Math.min(longRunKm, weeklyVolumeKm * 0.35);
  longRunKm = round1(Math.max(load.longRunFloorKm, Math.min(longRunKm, weeklyVolumeKm * 0.5)));

  const baseQuality = runDates.length <= 2 ? 0 : qualitySessionsFor(phase, exp);
  const qualityCount = Math.max(
    0,
    Math.min(baseQuality - load.qualityReduction, load.qualityCap ?? Number.POSITIVE_INFINITY)
  );
  // Assign the long run to the preferred day (or the last run day), then quality sessions spaced out.
  const longRunDate = runDates.find((d) => d.getUTCDay() === input.preferredLongRunDay) ?? runDates[runDates.length - 1];
  const qualityDates = pickQualityDates(runDates, longRunDate, qualityCount);

  // Distance budget: long run + quality first, remainder spread over easy days.
  const qualityKm = round1(clamp(weeklyVolumeKm * 0.18, 4, 12));
  const easyDates = runDates.filter((d) => d !== longRunDate && !qualityDates.includes(d));
  const easyBudget = Math.max(0, weeklyVolumeKm - longRunKm - qualityKm * qualityDates.length);
  const easyFloor = exp === "BEGINNER" ? load.easyFloorKm : Math.max(3, load.easyFloorKm);
  const easyEach = easyDates.length > 0 ? round1(Math.max(easyFloor, easyBudget / easyDates.length)) : 0;

  // Repeated hard impact is what a joint-protective week removes; a controlled tempo effort at
  // conversational-plus intensity is not the same load as interval reps, so it stays.
  const qualityKind = load.lowImpact ? "TEMPO" : pickQualityKind(params.qualityBias, exp);
  const referencePace = input.metrics.averagePaceLast28DaysSecondsPerKm;

  const workouts: PlannedWorkout[] = runDates.map((date) => {
    // Walk-run replaces every continuous-running session, the long one included: a longer walk-run
    // still builds time on feet, which is the thing that matters at this stage.
    if (load.walkRun) {
      const km = date === longRunDate ? longRunKm : easyEach || round1(weeklyVolumeKm / runDates.length);
      return workout(date, "WALK_RUN", km, phase, isFitnessGoal, referencePace, exp);
    }
    if (date === longRunDate) return workout(date, "LONG_RUN", longRunKm, phase, isFitnessGoal, referencePace, exp);
    if (qualityDates.includes(date)) return workout(date, qualityKind, qualityKm, phase, isFitnessGoal, referencePace, exp);
    const easyKind: SessionKind = phase === "RECOVERY" || phase === "BASELINE" ? "RECOVERY" : "EASY";
    return workout(date, easyKind, easyEach || round1(weeklyVolumeKm / runDates.length), phase, isFitnessGoal, referencePace, exp);
  });

  return { workouts, longRunKm, qualityCount: qualityDates.length };
}

// How many quality (tempo/interval) sessions a week carries, by phase + experience. Beginners get at
// most one, and only once past the baseline; the base phase stays mostly easy.
function qualitySessionsFor(phase: PlanPhase, exp: Experience): number {
  if (phase === "BASELINE" || phase === "RECOVERY") return 0;
  if (exp === "BEGINNER") return phase === "BASE" ? 0 : 1;
  if (phase === "BASE") return 1;
  if (phase === "TAPER") return 1;
  // BUILD / PEAK
  return exp === "ADVANCED" ? 2 : phase === "PEAK" ? 2 : 1;
}

function pickQualityKind(bias: QualityBias, exp: Experience): SessionKind {
  // A beginner's first taste of faster running should be strides inside an easy run, not a structured
  // interval session — at beginner volumes that much intensity is the fastest route to injury.
  // Progressing beginners on to true intervals once they hold volume is a later refinement.
  if (exp === "BEGINNER") return "STRIDES";
  if (bias === "SPEED") return "INTERVAL";
  if (bias === "THRESHOLD" || bias === "EASY") return "TEMPO";
  return "TEMPO"; // MIXED defaults to tempo; a second quality slot becomes intervals (handled in pickQualityDates order)
}

// Choose which available days carry a run. Keep the preferred long-run day if present, then fill the
// earliest remaining days, and always return them in chronological order.
function pickRunDates(dates: Date[], count: number, preferredLongRunDay: number | null): Date[] {
  if (count >= dates.length) return dates;
  const chosen = new Set<Date>();
  const longDay = preferredLongRunDay !== null ? dates.find((d) => d.getUTCDay() === preferredLongRunDay) : undefined;
  if (longDay) chosen.add(longDay);
  for (const date of dates) {
    if (chosen.size >= count) break;
    chosen.add(date);
  }
  return dates.filter((d) => chosen.has(d));
}

// Space quality sessions out: never the long-run day, never the day right before the long run, and not
// on consecutive days. Deterministic (earliest eligible first).
function pickQualityDates(runDates: Date[], longRunDate: Date, count: number): Date[] {
  if (count <= 0) return [];
  const chosen: Date[] = [];
  for (const date of runDates) {
    if (chosen.length >= count) break;
    if (date === longRunDate) continue;
    // day before the long run stays easy
    if (dayGap(date, longRunDate) === 1 && date < longRunDate) continue;
    // no two quality days back to back
    if (chosen.some((c) => dayGap(c, date) <= 1)) continue;
    chosen.push(date);
  }
  return chosen;
}

export const PHASE_LABEL: Record<PlanPhase, string> = {
  BASELINE: "Baseline",
  BASE: "Base",
  BUILD: "Build",
  PEAK: "Peak",
  TAPER: "Taper",
  RECOVERY: "Recovery"
};

// Beginners execute a session better on time than on distance — "run 25 minutes easy" is a target you
// can meet on any route, while a small distance target invites pushing the pace to get it over with.
// Derived from the session's own pace target, so it inherits the same no-invention rule: a beginner
// with no run history gets distance only, until they have logged enough for a reference pace.
const DURATION_ROUNDING_MIN = 5;

/**
 * The blended pace a walk-run actually covers ground at, used ONLY to turn a distance into minutes.
 *
 * Never returned as `targetPaceSecondsPerKm` — see derivePace(). Falls back to a plain brisk-walking
 * assumption when there is no run history, because a beginner on walk-runs is precisely the runner
 * least likely to have any, and "no time target at all" is the less useful answer here.
 */
const ASSUMED_WALK_RUN_SECONDS_PER_KM = 570; // 9:30/km — a brisk walk broken up by easy jogging

function walkRunDurationPace(referencePaceSecondsPerKm: number | null): number {
  if (
    referencePaceSecondsPerKm === null ||
    referencePaceSecondsPerKm < MIN_PACE_SECONDS_PER_KM ||
    referencePaceSecondsPerKm > MAX_PACE_SECONDS_PER_KM
  ) {
    return ASSUMED_WALK_RUN_SECONDS_PER_KM;
  }
  return clamp(referencePaceSecondsPerKm * PACE_FACTOR.WALK_RUN, MIN_PACE_SECONDS_PER_KM, MAX_PACE_SECONDS_PER_KM);
}

function beginnerDurationMin(kind: SessionKind, distanceKm: number, paceSecondsPerKm: number | null, exp: Experience): number | null {
  if (exp !== "BEGINNER" || paceSecondsPerKm === null) return null;
  // Quality work stays distance/effort-led; the time target is for the easy running that fills the week.
  if (kind === "TEMPO" || kind === "INTERVAL") return null;
  const minutes = (distanceKm * paceSecondsPerKm) / 60;
  const rounded = Math.round(minutes / DURATION_ROUNDING_MIN) * DURATION_ROUNDING_MIN;
  return Math.max(DURATION_ROUNDING_MIN, rounded);
}

function workout(
  date: Date,
  kind: SessionKind,
  distanceKm: number,
  phase: PlanPhase,
  isFitnessGoal: boolean,
  referencePaceSecondsPerKm: number | null,
  exp: Experience
): PlannedWorkout {
  const km = round1(distanceKm);
  const phaseTag = isFitnessGoal ? "" : `${PHASE_LABEL[phase]} · `;
  const spec: Record<SessionKind, { title: string; intensity: string; instructions: string; timedInstructions?: string }> = {
    LONG_RUN: {
      title: "Long run",
      intensity: "Comfortable, conversational effort",
      instructions: "Keep it easy and steady — build endurance, not speed. Fuel and hydrate; stop if anything hurts.",
      timedInstructions:
        "Stay out for the time shown and let the distance be whatever it turns out to be — time on your feet is what builds endurance at this stage. Keep it easy and steady, fuel and hydrate, and stop if anything hurts."
    },
    TEMPO: {
      title: "Tempo run",
      intensity: "Comfortably hard, controlled",
      instructions: "After an easy warm-up, settle into a controlled 'comfortably hard' effort you could just hold a few words at. Easy cool-down."
    },
    INTERVAL: {
      title: "Intervals",
      intensity: "Hard efforts with easy recovery",
      instructions: "Warm up well, then repeat short hard efforts with easy jog recovery between. Stop the reps if form or breathing falls apart."
    },
    EASY: {
      title: "Easy run",
      intensity: "Relaxed, conversational",
      instructions: "Fully conversational pace — this is where fitness is built. Slower is fine.",
      timedInstructions:
        "Run for the time shown rather than chasing the distance — the kilometres are just roughly what it works out to. Keep it fully conversational; slower is fine."
    },
    RECOVERY: {
      title: "Recovery jog",
      intensity: "Very easy",
      instructions: "Gentle and short — the point is to move and recover, not to train.",
      timedInstructions:
        "Jog gently for the time shown — the point is to move and recover, not to train. Distance does not matter here."
    },
    WALK_RUN: {
      title: "Walk-run session",
      intensity: "Easy throughout — never out of breath",
      instructions:
        "Alternate 2 minutes of easy jogging with 2 minutes of brisk walking, and repeat for the whole session. The walk is part of the training, not a failure — it is what lets you build up week after week without the pounding of continuous running. If the jogging leaves you breathless, make it slower or shorter and walk a little longer.",
      timedInstructions:
        "Alternate 2 minutes of easy jogging with 2 minutes of brisk walking for the time shown, and let the distance be whatever it turns out to be. The walk is part of the training, not a failure — it is what lets you build up week after week without the pounding of continuous running. If the jogging leaves you breathless, make it slower or shorter and walk a little longer."
    },
    STRIDES: {
      title: "Easy run + strides",
      intensity: "Relaxed, with short relaxed pickups",
      instructions:
        "Run the whole session easy and conversational. In the last third, add 4–6 strides: about 20 seconds of smooth, relaxed speed — fast but never straining — with a full easy jog or walk until you feel recovered between each. This teaches your legs to turn over quickly without the strain of a hard interval session.",
      timedInstructions:
        "Run for the time shown, easy and conversational throughout. In the last third, add 4–6 strides: about 20 seconds of smooth, relaxed speed — fast but never straining — with a full easy jog or walk until you feel recovered between each. This teaches your legs to turn over quickly without the strain of a hard interval session."
    }
  };
  const s = spec[kind] ?? spec.EASY;
  const pace = derivePace(kind, referencePaceSecondsPerKm);
  // A walk-run publishes no pace target, but time is exactly the right frame for it — so its
  // duration is estimated from the blended walk/jog factor rather than from the absent target.
  const durationReference = kind === "WALK_RUN" ? walkRunDurationPace(referencePaceSecondsPerKm) : pace;
  const durationMin = beginnerDurationMin(kind, km, durationReference, exp);
  return {
    scheduledFor: date.toISOString(),
    workoutType: KIND_TO_TYPE[kind],
    title: `${phaseTag}${s.title}`.trim(),
    targetDistanceKm: km,
    targetDurationMin: durationMin,
    // When there is a time target, use the session's timed wording. The minutes themselves stay in
    // targetDurationMin (which the UI renders) rather than being interpolated into the prose — an
    // interpolated string could never match the exact-lookup translation table, so beginners would
    // silently drop back to English in French and Arabic.
    instructions: durationMin === null ? s.instructions : (s.timedInstructions ?? s.instructions),
    intensity: s.intensity,
    targetPaceSecondsPerKm: pace
  };
}

// ---- small deterministic helpers ----
function weeksUntil(target: Date, now: Date): number {
  const ms = startOfUtcDay(target).getTime() - startOfUtcDay(now).getTime();
  return Math.ceil(ms / (7 * 24 * 60 * 60 * 1000));
}
function dayGap(a: Date, b: Date): number {
  return Math.abs(Math.round((startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime()) / (24 * 60 * 60 * 1000)));
}
function startOfUtcDay(value: Date): Date {
  const result = new Date(value);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
