import type { PlanAdherence } from "@/lib/coach/adherence";
import type { CoachMetrics } from "@/lib/coach/metrics";
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
type SessionKind = "LONG_RUN" | "TEMPO" | "INTERVAL" | "EASY" | "RECOVERY" | "STRIDES";

const KIND_TO_TYPE: Record<SessionKind, CoachWorkout["workoutType"]> = {
  LONG_RUN: "LONG_RUN",
  TEMPO: "TEMPO",
  INTERVAL: "INTERVAL",
  EASY: "EASY",
  RECOVERY: "RECOVERY",
  STRIDES: "EASY"
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
  INTERVAL: 0.88
};

// Sanity rails so a corrupt or freak average (a walk, a GPS glitch) can never yield an absurd target.
const MIN_PACE_SECONDS_PER_KM = 150; // 2:30/km — faster than any recreational target
const MAX_PACE_SECONDS_PER_KM = 900; // 15:00/km — slower than a walk-run

// Derive a numeric pace target (seconds per km) for a session, or null when there is no trustworthy
// reference pace to derive it from.
function derivePace(kind: SessionKind, referencePaceSecondsPerKm: number | null): number | null {
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

export function buildAdaptivePlan(input: AdaptivePlannerInput, now = new Date()): AdaptivePlan {
  const exp = input.experienceLevel;
  const params = GOAL_PARAMS[input.goalType] ?? GOAL_PARAMS.OTHER;
  const isFitnessGoal = input.goalType === "GENERAL_FITNESS";

  const weeksToRace = weeksUntil(input.targetDate, now);
  // No runs in the last week (with little recent history) → treat as a return-to-running rebuild.
  const returning = input.metrics.runCountLast7Days === 0 && input.metrics.distanceLast28DaysKm < WEEKLY_FLOOR[exp];

  const adaptations: string[] = [];
  const phase = determinePhase({ weeksToRace, exp, input, returning, isFitnessGoal, adaptations });
  const weeklyVolumeKm = computeWeeklyVolume({ phase, exp, params, input, adaptations });

  const week = buildWeek({ phase, exp, params, isFitnessGoal, weeklyVolumeKm, input, now });

  return {
    phase,
    weeksToRace,
    weeklyVolumeKm,
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
  returning,
  isFitnessGoal,
  adaptations
}: {
  weeksToRace: number;
  exp: Experience;
  input: AdaptivePlannerInput;
  returning: boolean;
  isFitnessGoal: boolean;
  adaptations: string[];
}): PlanPhase {
  if (returning) {
    adaptations.push("Returning from a break — rebuilding with easy running.");
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
  // Far out, or a beginner still building volume → base.
  const recent = Math.max(input.metrics.distanceLast7DaysKm, input.currentWeeklyDistanceKm);
  if (exp === "BEGINNER" && recent < WEEKLY_FLOOR.BEGINNER * 1.6) return "BASELINE";
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

function computeWeeklyVolume({
  phase,
  exp,
  params,
  input,
  adaptations
}: {
  phase: PlanPhase;
  exp: Experience;
  params: (typeof GOAL_PARAMS)[GoalType];
  input: AdaptivePlannerInput;
  adaptations: string[];
}): number {
  const recent = Math.max(input.metrics.distanceLast7DaysKm, 0);
  const anchor = Math.max(recent, input.currentWeeklyDistanceKm, WEEKLY_FLOOR[exp]);

  let volume = anchor * PHASE_FACTOR[phase] * params.volumeMult;

  // Injury-prevention: in progressing phases never jump more than ~10% over recent actual (plus a small
  // absolute allowance so a runner coming off a light week isn't frozen).
  if (phase === "BASE" || phase === "BUILD" || phase === "BASELINE") {
    volume = Math.min(volume, Math.max(recent, input.currentWeeklyDistanceKm) * 1.1 + 3);
  }

  // Ceilings: known peak volume, then the hard experience cap.
  volume = Math.min(volume, input.peakWeeklyDistanceKm ?? WEEKLY_CEILING[exp], WEEKLY_CEILING[exp]);

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
  now
}: {
  phase: PlanPhase;
  exp: Experience;
  params: (typeof GOAL_PARAMS)[GoalType];
  isFitnessGoal: boolean;
  weeklyVolumeKm: number;
  input: AdaptivePlannerInput;
  now: Date;
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

  // Cap how many of the available days carry a run (rest matters, especially for beginners).
  const runDayCount = Math.min(trainingDates.length, MAX_RUN_DAYS[exp]);
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
  longRunKm = round1(Math.max(4, Math.min(longRunKm, weeklyVolumeKm * 0.5)));

  const qualityCount = runDates.length <= 2 ? 0 : qualitySessionsFor(phase, exp);
  // Assign the long run to the preferred day (or the last run day), then quality sessions spaced out.
  const longRunDate = runDates.find((d) => d.getUTCDay() === input.preferredLongRunDay) ?? runDates[runDates.length - 1];
  const qualityDates = pickQualityDates(runDates, longRunDate, qualityCount);

  // Distance budget: long run + quality first, remainder spread over easy days.
  const qualityKm = round1(clamp(weeklyVolumeKm * 0.18, 4, 12));
  const easyDates = runDates.filter((d) => d !== longRunDate && !qualityDates.includes(d));
  const easyBudget = Math.max(0, weeklyVolumeKm - longRunKm - qualityKm * qualityDates.length);
  const easyEach = easyDates.length > 0 ? round1(Math.max(exp === "BEGINNER" ? 2 : 3, easyBudget / easyDates.length)) : 0;

  const qualityKind = pickQualityKind(params.qualityBias, exp);
  const referencePace = input.metrics.averagePaceLast28DaysSecondsPerKm;

  const workouts: PlannedWorkout[] = runDates.map((date) => {
    if (date === longRunDate) return workout(date, "LONG_RUN", longRunKm, phase, isFitnessGoal, referencePace);
    if (qualityDates.includes(date)) return workout(date, qualityKind, qualityKm, phase, isFitnessGoal, referencePace);
    const easyKind: SessionKind = phase === "RECOVERY" || phase === "BASELINE" ? "RECOVERY" : "EASY";
    return workout(date, easyKind, easyEach || round1(weeklyVolumeKm / runDates.length), phase, isFitnessGoal, referencePace);
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

function workout(
  date: Date,
  kind: SessionKind,
  distanceKm: number,
  phase: PlanPhase,
  isFitnessGoal: boolean,
  referencePaceSecondsPerKm: number | null
): PlannedWorkout {
  const km = round1(distanceKm);
  const phaseTag = isFitnessGoal ? "" : `${PHASE_LABEL[phase]} · `;
  const spec: Record<SessionKind, { title: string; intensity: string; instructions: string }> = {
    LONG_RUN: {
      title: "Long run",
      intensity: "Comfortable, conversational effort",
      instructions: "Keep it easy and steady — build endurance, not speed. Fuel and hydrate; stop if anything hurts."
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
      instructions: "Fully conversational pace — this is where fitness is built. Slower is fine."
    },
    RECOVERY: {
      title: "Recovery jog",
      intensity: "Very easy",
      instructions: "Gentle and short — the point is to move and recover, not to train."
    },
    STRIDES: {
      title: "Easy run + strides",
      intensity: "Relaxed, with short relaxed pickups",
      instructions:
        "Run the whole session easy and conversational. In the last third, add 4–6 strides: about 20 seconds of smooth, relaxed speed — fast but never straining — with a full easy jog or walk until you feel recovered between each. This teaches your legs to turn over quickly without the strain of a hard interval session."
    }
  };
  const s = spec[kind] ?? spec.EASY;
  return {
    scheduledFor: date.toISOString(),
    workoutType: KIND_TO_TYPE[kind],
    title: `${phaseTag}${s.title}`.trim(),
    targetDistanceKm: km,
    targetDurationMin: null,
    intensity: s.intensity,
    instructions: s.instructions,
    targetPaceSecondsPerKm: derivePace(kind, referencePaceSecondsPerKm)
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
