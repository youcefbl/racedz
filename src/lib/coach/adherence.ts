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
