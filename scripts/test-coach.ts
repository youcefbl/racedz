import assert from "node:assert/strict";
import { calculateAveragePaceSecondsPerKm, calculateCoachMetrics } from "../src/lib/coach/metrics";
import { buildWeeklyPlanSkeleton } from "../src/lib/coach/planning";
import { buildBlockedCoachResponse, enforceCoachSafety, evaluateCoachSafety } from "../src/lib/coach/safety";

const now = new Date("2026-06-21T12:00:00.000Z");

assert.equal(calculateAveragePaceSecondsPerKm(10, 3000), 300);
assert.throws(() => calculateAveragePaceSecondsPerKm(0, 3000));

const metrics = calculateCoachMetrics(
  [
    { startedAt: "2026-06-20T08:00:00.000Z", distanceKm: 6, durationSeconds: 2100, perceivedEffort: 5, fatigueLevel: 4, painLevel: 0 },
    { startedAt: "2026-06-15T08:00:00.000Z", distanceKm: 4, durationSeconds: 1500, perceivedEffort: 4, fatigueLevel: 3, painLevel: 0 },
    { startedAt: "2026-06-10T08:00:00.000Z", distanceKm: 5, durationSeconds: 1900, perceivedEffort: 5, fatigueLevel: 3, painLevel: 0 }
  ],
  now
);
assert.equal(metrics.runCountLast7Days, 2);
assert.equal(metrics.distanceLast7DaysKm, 10);
assert.equal(metrics.distancePrevious7DaysKm, 5);
assert.equal(metrics.weeklyDistanceChangePercent, 100);

const skeleton = buildWeeklyPlanSkeleton(
  {
    experienceLevel: "BEGINNER",
    currentWeeklyDistanceKm: 10,
    availableTrainingDays: [1, 3, 6],
    preferredLongRunDay: 6
  },
  metrics,
  now
);
assert.equal(skeleton.length, 3);
assert.equal(skeleton.at(-1)?.workoutType, "LONG_RUN");
assert.ok(skeleton.every((workout) => workout.workoutType !== "TEMPO" && workout.workoutType !== "INTERVAL"));

const blocked = evaluateCoachSafety(
  { painLevel: 2, fatigueLevel: 3, symptoms: "Douleur à la poitrine", notes: null },
  metrics
);
assert.equal(blocked.level, "BLOCKED");
assert.equal(buildBlockedCoachResponse(blocked, "fr").requiresProfessionalAdvice, true);

const caution = evaluateCoachSafety({ painLevel: 5, fatigueLevel: 2, symptoms: null, notes: null }, { ...metrics, weeklyDistanceChangePercent: 0 });
assert.equal(caution.level, "CAUTION");

const safeResponse = enforceCoachSafety(
  {
    summary: "Summary",
    progressAssessment: "Progress",
    positiveSignals: [],
    warningSignals: [],
    nextWorkout: null,
    upcomingWorkouts: skeleton.map((workout) => ({
      ...workout,
      workoutType: "INTERVAL",
      targetDistanceKm: 100,
      instructions: "Run 100 hard sprints."
    })),
    recoveryAdvice: [],
    requiresProfessionalAdvice: false,
    usedSignals: [],
    dataGaps: [],
    followUpQuestion: null,
    memoryCandidates: []
  },
  caution,
  skeleton,
  "ar"
);
assert.ok(safeResponse.upcomingWorkouts.every((workout) => workout.workoutType === "RECOVERY"));
assert.ok(safeResponse.upcomingWorkouts.every((workout, index) => (workout.targetDistanceKm ?? 0) <= (skeleton[index].targetDistanceKm ?? 0)));
assert.ok(safeResponse.upcomingWorkouts.every((workout) => workout.instructions !== undefined && !workout.instructions.includes("100")));
// The plan must be returned in the runner's selected coach language, not English.
assert.ok(safeResponse.upcomingWorkouts.every((workout) => /[؀-ۿ]/.test(workout.title)));
assert.ok(safeResponse.upcomingWorkouts.every((workout) => /[؀-ۿ]/.test(workout.instructions)));

console.log("Coach metrics, planning, and safety checks passed.");
