import type { CoachMetrics, MetricRun } from "@/lib/coach/metrics";
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
  symptoms: string | null;
  notes: string | null;
};

export function buildRunnerCoachContext(input: {
  goal: ContextGoal;
  runs: ContextRun[];
  metrics: CoachMetrics;
  skeleton: CoachWorkout[];
  safety: CoachSafetyDecision;
  interaction: CoachInteractionInput;
  profile?: { sex: string | null; age: number | null };
}) {
  return {
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
    recentRuns: input.runs.slice(0, 10).map((run) => ({
      startedAt: new Date(run.startedAt).toISOString(),
      distanceKm: run.distanceKm,
      durationSeconds: run.durationSeconds,
      averagePaceSecondsPerKm: run.averagePaceSecondsPerKm,
      elevationGainM: run.elevationGainM,
      averageHeartRate: run.averageHeartRate,
      perceivedEffort: run.perceivedEffort,
      fatigueLevel: run.fatigueLevel,
      painLevel: run.painLevel,
      symptoms: run.symptoms,
      notes: run.notes
    })),
    fixedSafetyDecision: input.safety,
    fixedWeeklyPlanSkeleton: input.skeleton
  };
}

// Body Mass Index (kg/m²), rounded to one decimal. Null when weight or height is unknown,
// giving the coach a quick read on the runner's build alongside raw weight and height.
function computeBmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

