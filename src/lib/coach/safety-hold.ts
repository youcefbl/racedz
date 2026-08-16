import { getPrisma } from "@/lib/db";

export type CoachSafetyAlert = {
  status: "ACTIVE";
  sourceInteractionId: string;
  triggeredAt: string;
};

type SafetyRow = { id: string; createdAt: Date; safety: unknown };

/**
 * Returns the latest unresolved urgent exercise hold for this runner.
 *
 * The hold stays in the deterministic interaction safety JSON: no duplicated symptom text and no
 * new health-data store outside the existing Coach consent and retention boundary.
 */
export async function getCoachSafetyAlert(userId: string): Promise<CoachSafetyAlert | null> {
  const rows = await getPrisma().$queryRaw<SafetyRow[]>`
    SELECT "id", "createdAt", "safety"
    FROM "CoachInteraction"
    WHERE "userId" = ${userId}
      AND "status" = 'BLOCKED'
      AND "safety" #>> '{exerciseHold,status}' = 'ACTIVE'
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { status: "ACTIVE", sourceInteractionId: row.id, triggeredAt: row.createdAt.toISOString() };
}

/**
 * Clears the caller's unresolved holds after an explicit medical-clearance attestation.
 *
 * Every ACTIVE hold, not just the newest: a runner who reported a red flag twice has two rows, and
 * clearing one at a time would leave the notice on screen after they attested — reading as though
 * the app had ignored them. The clearance is one statement about one person, so it settles all of
 * them. Scoped to `userId`, and the interaction rows themselves are never deleted.
 */
export async function confirmCoachMedicalClearance(userId: string): Promise<boolean> {
  const clearedAt = new Date().toISOString();
  const changed = await getPrisma().$executeRaw`
    UPDATE "CoachInteraction"
    SET "safety" = jsonb_set(
      COALESCE("safety", '{}'::jsonb),
      '{exerciseHold}',
      CAST(${JSON.stringify({ status: "CLEARED", clearedAt })} AS jsonb),
      true
    )
    WHERE "userId" = ${userId}
      AND "safety" #>> '{exerciseHold,status}' = 'ACTIVE'
  `;
  return changed > 0;
}
