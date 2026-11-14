import type { assembleCoachContext } from "../../src/lib/coach/context";
import { calculateCoachMetrics } from "../../src/lib/coach/metrics";
import { evaluateCoachSafety } from "../../src/lib/coach/safety";

export const COACH_EVAL_NOW = new Date("2026-11-14T10:00:00Z");
export type CoachContextFixture = Parameters<typeof assembleCoachContext>[0];
/** Entirely synthetic; no DB, identities, GPS or health record access. */
export function coachContextFixture(overrides: Partial<CoachContextFixture> = {}): CoachContextFixture {
  const metrics = calculateCoachMetrics([], COACH_EVAL_NOW);
  return {
    goal: {
      id: "synthetic-goal", goalType: "TEN_K", customGoal: null, targetDate: new Date("2027-02-14T00:00:00Z"),
      targetDistanceKm: 10, targetTimeSeconds: null, experienceLevel: "BEGINNER", currentWeeklyDistanceKm: 10,
      yearsRunning: 1, peakWeeklyDistanceKm: 15, longestRecentRunKm: 5, recentRaceResult: null,
      restingHeartRate: null, weightKg: null, heightCm: null, availableTrainingDays: [1, 3, 5], preferredLongRunDay: 5,
      constraints: null, injuryNotes: null, injuryHistory: null, chronicConditions: [], healthNotes: null, preferredLocale: "en"
    }, runs: [], metrics, skeleton: [],
    safety: evaluateCoachSafety({ painLevel: 0, fatigueLevel: 0, symptoms: null, notes: null }, metrics),
    interaction: { type: "CHAT", message: "How should I start running?" },
    ...overrides
  };
}
