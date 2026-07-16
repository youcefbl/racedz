// Plan-adherence helpers (Phase 1). Deterministic and pure — the application owns data integrity,
// the AI only explains it. Phase 1.4's adherence metrics will grow alongside these.

export type WorkoutCompletionType = "AS_PLANNED" | "PARTIAL" | "EASIER_THAN_PLANNED" | "HARDER_THAN_PLANNED";

// A run whose distance falls below this fraction of the planned distance is treated as only a
// partial completion rather than the full session.
export const PARTIAL_DISTANCE_RATIO = 0.75;

// Classify how a run fulfilled a planned workout, from the reliable signal available at link time:
// actual distance vs the planned target. The intensity-based EASIER_THAN_PLANNED /
// HARDER_THAN_PLANNED variants need a planned-vs-actual effort comparison and are deliberately
// deferred to a later phase — we never infer them from distance alone, which would be wrong (a long
// easy run isn't "harder than planned"). With no target distance, an explicit runner link is taken
// at face value as AS_PLANNED.
export function deriveWorkoutCompletionType(
  targetDistanceKm: number | null | undefined,
  actualDistanceKm: number
): WorkoutCompletionType {
  if (!targetDistanceKm || targetDistanceKm <= 0) return "AS_PLANNED";
  if (!Number.isFinite(actualDistanceKm) || actualDistanceKm <= 0) return "AS_PLANNED";
  return actualDistanceKm / targetDistanceKm < PARTIAL_DISTANCE_RATIO ? "PARTIAL" : "AS_PLANNED";
}

// ---------------------------------------------------------------------------------------------
// Run → planned-workout matching (Phase 1.3)
//
// The riskiest deterministic component: a wrong auto-link corrupts the adherence metrics, which then
// corrupt the plan adaptation, so errors compound. The matcher is therefore deliberately conservative
// and biased toward *asking* — only a same-day run within a tight distance band of a known target is
// auto-linked; anything looser becomes a suggestion the runner confirms, and everything else stays a
// free run.
// ---------------------------------------------------------------------------------------------

// Workout types a logged run can fulfil. REST and CROSS_TRAINING are never matched to a run.
export const RUN_MATCHABLE_WORKOUT_TYPES = ["EASY", "LONG_RUN", "TEMPO", "INTERVAL", "RECOVERY", "RACE"] as const;

// Auto-link only within ±15% of the planned distance; suggest up to ±40%.
export const AUTO_MATCH_DISTANCE_TOLERANCE = 0.15;
export const SUGGEST_MATCH_DISTANCE_TOLERANCE = 0.4;

export type WorkoutMatchTier = "AUTO" | "SUGGEST" | "NONE";

export type WorkoutMatchCandidate = {
  workoutId: string;
  workoutType: string;
  targetDistanceKm: number | null;
  // Whole days between the run's and the workout's Algiers calendar dates (0 = same day).
  dayDelta: number;
};

export type ScoredWorkoutMatch = { tier: WorkoutMatchTier; confidence: number };

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Score one candidate workout for a run of the given distance. Returns the tier and a 0–1 confidence.
export function scoreWorkoutMatch(runDistanceKm: number, candidate: WorkoutMatchCandidate): ScoredWorkoutMatch {
  const running = (RUN_MATCHABLE_WORKOUT_TYPES as readonly string[]).includes(candidate.workoutType);
  if (!running) return { tier: "NONE", confidence: 0 };
  if (!Number.isFinite(candidate.dayDelta) || candidate.dayDelta > 1) return { tier: "NONE", confidence: 0 };

  const sameDay = candidate.dayDelta === 0;
  const target = candidate.targetDistanceKm;
  const distanceErr =
    target && target > 0 && runDistanceKm > 0 ? Math.abs(runDistanceKm - target) / target : null;

  // Confident auto-link: same local day, running type, distance within 15% of a known target.
  if (sameDay && distanceErr !== null && distanceErr <= AUTO_MATCH_DISTANCE_TOLERANCE) {
    return { tier: "AUTO", confidence: round2(clamp(1 - distanceErr, 0.8, 1)) };
  }
  // Suggest (ask the runner): same day but distance unknown or looser than the auto band.
  if (sameDay && (distanceErr === null || distanceErr <= SUGGEST_MATCH_DISTANCE_TOLERANCE)) {
    return { tier: "SUGGEST", confidence: distanceErr === null ? 0.5 : round2(clamp(0.75 - distanceErr, 0.4, 0.75)) };
  }
  // Adjacent day with a good distance match is a weak suggestion, never an auto-link.
  if (!sameDay && distanceErr !== null && distanceErr <= AUTO_MATCH_DISTANCE_TOLERANCE) {
    return { tier: "SUGGEST", confidence: 0.5 };
  }
  return { tier: "NONE", confidence: 0 };
}

// Pick the single best candidate: AUTO beats SUGGEST, then higher confidence wins. Null if none match.
export function pickBestWorkoutMatch(
  runDistanceKm: number,
  candidates: WorkoutMatchCandidate[]
): { candidate: WorkoutMatchCandidate; scored: ScoredWorkoutMatch } | null {
  const rank = (tier: WorkoutMatchTier) => (tier === "AUTO" ? 2 : tier === "SUGGEST" ? 1 : 0);
  let best: { candidate: WorkoutMatchCandidate; scored: ScoredWorkoutMatch } | null = null;
  for (const candidate of candidates) {
    const scored = scoreWorkoutMatch(runDistanceKm, candidate);
    if (scored.tier === "NONE") continue;
    if (
      !best ||
      rank(scored.tier) > rank(best.scored.tier) ||
      (rank(scored.tier) === rank(best.scored.tier) && scored.confidence > best.scored.confidence)
    ) {
      best = { candidate, scored };
    }
  }
  return best;
}
