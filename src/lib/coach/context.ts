import type { RunRoutePoint } from "@/components/coach/types";
import type { CoachMetrics, MetricRun } from "@/lib/coach/metrics";
import { computeSplits } from "@/lib/coach/run-stats";
import type { CoachInteractionInput, CoachWorkout } from "@/lib/coach/schemas";
import type { CoachSafetyDecision } from "@/lib/coach/safety";

type ContextGoal = {
  id: string;
  goalType: string;
  customGoal: string | null;
  targetDate: Date;
  targetDistanceKm: number | null;
  targetTimeSeconds: number | null;
  experienceLevel: string;
  currentWeeklyDistanceKm: number;
  yearsRunning: number | null;
  peakWeeklyDistanceKm: number | null;
  longestRecentRunKm: number | null;
  recentRaceResult: string | null;
  restingHeartRate: number | null;
  weightKg: number | null;
  heightCm: number | null;
  availableTrainingDays: number[];
  preferredLongRunDay: number | null;
  constraints: string | null;
  injuryNotes: string | null;
  injuryHistory: string | null;
  chronicConditions: string[];
  healthNotes: string | null;
  preferredLocale: "en" | "fr" | "ar";
};

type ContextRun = MetricRun & {
  id: string;
  averagePaceSecondsPerKm: number;
  elevationGainM: number | null;
  averageHeartRate: number | null;
  avgCadence: number | null;
  symptoms: string | null;
  notes: string | null;
};

type TargetRun = ContextRun & {
  movingTimeSeconds?: number | null;
  calories?: number | null;
  route?: RunRoutePoint[] | null;
};

// One prior coach exchange, condensed to what keeps the conversation coherent: the runner's
// question (if any) and a short trace of what the coach already told them. Lets each reply
// build on recent history instead of repeating advice the runner just received.
export type ConversationTurn = {
  type: CoachInteractionInput["type"];
  at: Date | string;
  runnerQuestion: string | null;
  coachSummary: string | null;
};

// Guardrails so one runner's free-text or GPS history can never blow up the prompt. We keep the
// full picture when it fits and only trim the long tail (older runs, verbose notes) when it doesn't.
const MAX_RECENT_RUNS = 10;
const MAX_CONVERSATION_TURNS = 6;
const MAX_NOTE_CHARS = 500;
const MAX_SUMMARY_CHARS = 400;
const COMPACT_THRESHOLD_CHARS = 14000;

export function buildRunnerCoachContext(input: {
  goal: ContextGoal;
  runs: ContextRun[];
  metrics: CoachMetrics;
  skeleton: CoachWorkout[];
  safety: CoachSafetyDecision;
  interaction: CoachInteractionInput;
  profile?: { sex: string | null; age: number | null };
  targetRun?: TargetRun | null;
  recentConversation?: ConversationTurn[];
}) {
  const context = {
    request: {
      type: input.interaction.type,
      runnerQuestion: input.interaction.message ?? null,
      responseLocale: input.goal.preferredLocale
    },
    runner: {
      sex: input.profile?.sex ?? null,
      age: input.profile?.age ?? null
    },
    goal: {
      type: input.goal.goalType,
      customGoal: input.goal.customGoal,
      targetDate: input.goal.targetDate.toISOString(),
      targetDistanceKm: input.goal.targetDistanceKm,
      targetTimeSeconds: input.goal.targetTimeSeconds,
      experienceLevel: input.goal.experienceLevel,
      declaredWeeklyDistanceKm: input.goal.currentWeeklyDistanceKm,
      yearsRunning: input.goal.yearsRunning,
      peakWeeklyDistanceKm: input.goal.peakWeeklyDistanceKm,
      longestRecentRunKm: input.goal.longestRecentRunKm,
      recentRaceResult: input.goal.recentRaceResult,
      restingHeartRate: input.goal.restingHeartRate,
      weightKg: input.goal.weightKg,
      heightCm: input.goal.heightCm,
      bmi: computeBmi(input.goal.weightKg, input.goal.heightCm),
      availableTrainingDays: input.goal.availableTrainingDays,
      preferredLongRunDay: input.goal.preferredLongRunDay,
      constraints: input.goal.constraints,
      injuryNotes: input.goal.injuryNotes,
      injuryHistory: input.goal.injuryHistory,
      chronicConditions: input.goal.chronicConditions,
      healthNotes: input.goal.healthNotes
    },
    computedMetrics: input.metrics,
    // The specific run this feedback is about, when the runner asked to analyse one. Given its
    // own block (with per-km splits) so the coach centres the reply on it instead of guessing.
    analysedRun: input.targetRun ? describeTargetRun(input.targetRun) : null,
    recentRuns: input.runs.slice(0, MAX_RECENT_RUNS).map(describeRun),
    // Prior exchanges, oldest→newest, so the coach can reference what the runner asked recently.
    recentConversation: (input.recentConversation ?? [])
      .slice(-MAX_CONVERSATION_TURNS)
      .map((turn) => ({
        type: turn.type,
        at: new Date(turn.at).toISOString(),
        runnerQuestion: truncate(turn.runnerQuestion, MAX_NOTE_CHARS),
        coachSummary: truncate(turn.coachSummary, MAX_SUMMARY_CHARS)
      })),
    fixedSafetyDecision: input.safety,
    fixedWeeklyPlanSkeleton: input.skeleton
  };

  return compactIfNeeded(context);
}

function describeRun(run: ContextRun) {
  return {
    startedAt: new Date(run.startedAt).toISOString(),
    distanceKm: run.distanceKm,
    durationSeconds: run.durationSeconds,
    averagePaceSecondsPerKm: run.averagePaceSecondsPerKm,
    elevationGainM: run.elevationGainM,
    averageHeartRate: run.averageHeartRate,
    avgCadence: run.avgCadence,
    perceivedEffort: run.perceivedEffort,
    fatigueLevel: run.fatigueLevel,
    painLevel: run.painLevel,
    symptoms: truncate(run.symptoms, MAX_NOTE_CHARS),
    notes: truncate(run.notes, MAX_NOTE_CHARS)
  };
}

function describeTargetRun(run: TargetRun) {
  const splits = computeSplits(run.route ?? null).map((split) => ({
    km: split.index,
    meters: split.meters,
    paceSecondsPerKm: split.paceSecondsPerKm,
    elevationGainM: split.elevationGainM,
    fastest: split.fastest ?? false,
    slowest: split.slowest ?? false
  }));

  return {
    ...describeRun(run),
    movingTimeSeconds: run.movingTimeSeconds ?? null,
    calories: run.calories ?? null,
    // Per-kilometre splits let the coach comment on pacing (fade, negative split, hills) precisely.
    perKmSplits: splits.length ? splits : null
  };
}

// Body Mass Index (kg/m²), rounded to one decimal. Null when weight or height is unknown,
// giving the coach a quick read on the runner's build alongside raw weight and height.
function computeBmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed || null;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

// Each runner's context is built fresh, so it stays personal by construction. Compaction only
// kicks in for the rare runner whose serialized context is unusually large (many long runs plus
// verbose notes): we drop the oldest recent runs and trim conversation history, keeping the
// analysed run, goal, metrics and latest exchanges — the details that drive the reply — intact.
function compactIfNeeded<T extends { recentRuns: unknown[]; recentConversation: unknown[] }>(context: T): T {
  if (JSON.stringify(context).length <= COMPACT_THRESHOLD_CHARS) return context;
  return {
    ...context,
    recentRuns: context.recentRuns.slice(0, 5),
    recentConversation: context.recentConversation.slice(-3)
  };
}
