import type { CoachMetrics } from "@/lib/coach/metrics";
import type { CoachWorkout } from "@/lib/coach/schemas";

type PlanGoal = {
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  currentWeeklyDistanceKm: number;
  availableTrainingDays: number[];
  preferredLongRunDay: number | null;
};

export function buildWeeklyPlanSkeleton(goal: PlanGoal, metrics: CoachMetrics, now = new Date()): CoachWorkout[] {
  const availableDays = new Set(goal.availableTrainingDays);
  const dates: Date[] = [];
  const cursor = startOfUtcDay(now);

  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(cursor);
    date.setUTCDate(date.getUTCDate() + offset);
    if (availableDays.has(date.getUTCDay())) dates.push(date);
  }

  const baseline = Math.max(metrics.distanceLast7DaysKm, goal.currentWeeklyDistanceKm);
  const weeklyBudget = round(Math.max(goal.experienceLevel === "BEGINNER" ? 5 : 8, baseline * 1.1));
  const longRunDay = dates.find((date) => date.getUTCDay() === goal.preferredLongRunDay) ?? dates.at(-1);
  const longRunDistance = round(Math.min(weeklyBudget * 0.4, Math.max(weeklyBudget - 2, weeklyBudget * 0.5)));
  const normalRunCount = Math.max(1, dates.length - 1);
  const normalDistance = round(Math.max(1, (weeklyBudget - longRunDistance) / normalRunCount));
  let hardWorkoutAssigned = false;

  return dates.map((date) => {
    const isLongRun = longRunDay?.getTime() === date.getTime();
    const canAddTempo = goal.experienceLevel !== "BEGINNER" && dates.length >= 4 && !hardWorkoutAssigned && !isLongRun;
    const workoutType = isLongRun ? "LONG_RUN" : canAddTempo ? "TEMPO" : "EASY";
    if (canAddTempo) hardWorkoutAssigned = true;

    return {
      scheduledFor: date.toISOString(),
      workoutType,
      title: isLongRun ? "Long easy run" : canAddTempo ? "Controlled tempo run" : "Easy run",
      targetDistanceKm: isLongRun ? longRunDistance : normalDistance,
      targetDurationMin: null,
      intensity: canAddTempo ? "Moderate and controlled" : "Comfortable conversational effort",
      instructions: "Keep the effort controlled. Stop and seek appropriate advice if concerning symptoms appear."
    };
  });
}

function startOfUtcDay(value: Date) {
  const result = new Date(value);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

