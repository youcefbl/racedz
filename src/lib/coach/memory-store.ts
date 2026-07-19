import "server-only";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import {
  selectMemoryForContext,
  validateMemoryCandidates,
  type MemoryContextItem,
  type MemoryRecord,
  type MemoryWriteCandidate
} from "@/lib/coach/memory";

// Database side of coaching memory. The selection and validation rules live in memory.ts so they can
// be tested without a database; this module only reads, writes and supersedes.

type MemoryRow = MemoryRecord & { sourceInteractionId: string | null };

async function readMemories(userId: string): Promise<MemoryRow[]> {
  return getPrisma().$queryRaw<MemoryRow[]>`
    SELECT "id", "goalId", "kind"::text AS "kind", "key", "value", "source"::text AS "source",
           "sourceInteractionId", "confidence", "status"::text AS "status",
           "confirmedAt", "expiresAt", "createdAt", "updatedAt"
    FROM "CoachMemory"
    WHERE "userId" = ${userId} AND "status" = 'ACTIVE'
    ORDER BY "updatedAt" DESC
    LIMIT 200
  `;
}

/** The memory block for the AI context: relevant, in-budget, goal-scoped. */
export async function getMemoryForContext(userId: string, goalId: string | null, now = new Date()): Promise<MemoryContextItem[]> {
  const records = await readMemories(userId);
  return selectMemoryForContext(records, { goalId, now });
}

/**
 * Write validated memory, superseding any previous active value for the same (kind, key).
 *
 * Returns what was rejected so callers can log it — a model repeatedly proposing blocked kinds is
 * something we want visible, not silently dropped.
 */
export async function writeMemories(
  userId: string,
  candidates: MemoryWriteCandidate[],
  now = new Date()
): Promise<{ written: number; rejected: Array<{ kind: string; reason: string }> }> {
  const { accepted, rejected } = validateMemoryCandidates(candidates, now);
  if (accepted.length === 0) {
    return { written: 0, rejected: rejected.map((r) => ({ kind: r.candidate.kind, reason: r.reason })) };
  }

  const prisma = getPrisma();
  await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
    for (const candidate of accepted) {
      // A newer value for the same slot retires the old one rather than deleting it — the audit trail
      // is part of the memory-quality rules. DISMISSED rows are left alone: the runner removed those,
      // and re-learning them automatically would undo an explicit correction.
      await tx.$executeRaw`
        UPDATE "CoachMemory"
        SET "status" = 'SUPERSEDED', "updatedAt" = NOW()
        WHERE "userId" = ${userId} AND "kind" = ${candidate.kind}::"CoachMemoryKind"
          AND "key" = ${candidate.key} AND "status" = 'ACTIVE'
      `;
      await tx.$executeRaw`
        INSERT INTO "CoachMemory" (
          "id", "userId", "goalId", "kind", "key", "value", "source", "sourceInteractionId",
          "confidence", "status", "expiresAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${userId}, ${candidate.goalId ?? null}, ${candidate.kind}::"CoachMemoryKind",
          ${candidate.key}, ${candidate.value}, ${candidate.source}::"CoachMemorySource",
          ${candidate.sourceInteractionId ?? null}, ${candidate.confidence ?? null}, 'ACTIVE',
          ${candidate.expiresAt ?? null}, NOW()
        )
      `;
    }
  });

  return { written: accepted.length, rejected: rejected.map((r) => ({ kind: r.candidate.kind, reason: r.reason })) };
}

/**
 * Record that the runner rejected a suggestion, so the coach stops repeating it.
 *
 * Written by the app from a real runner action rather than inferred, which is why it is SYSTEM_DERIVED
 * and allowed even though the model may not propose this kind itself.
 */
export async function rememberRejectedSuggestion(
  userId: string,
  input: { key: string; suggestion: string; goalId?: string | null; interactionId?: string | null },
  now = new Date()
) {
  return writeMemories(
    userId,
    [
      {
        kind: "REJECTED_SUGGESTION",
        key: input.key,
        value: input.suggestion,
        source: "SYSTEM_DERIVED",
        goalId: input.goalId ?? null,
        sourceInteractionId: input.interactionId ?? null
      }
    ],
    now
  );
}

// ── Runner data controls ─────────────────────────────────────────────────────

/** Everything stored about this runner's memory, for inspection and export. */
export async function exportMemory(userId: string) {
  const rows = await getPrisma().$queryRaw<Array<MemoryRow & { status: string }>>`
    SELECT "id", "goalId", "kind"::text AS "kind", "key", "value", "source"::text AS "source",
           "sourceInteractionId", "confidence", "status"::text AS "status",
           "confirmedAt", "expiresAt", "createdAt", "updatedAt"
    FROM "CoachMemory"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
  `;
  return rows;
}

/**
 * The runner dismisses a fact. Scoped by userId in the WHERE clause so one runner can never dismiss
 * another's memory even with a guessed id.
 */
export async function dismissMemory(userId: string, memoryId: string): Promise<{ dismissed: boolean }> {
  const count = await getPrisma().$executeRaw`
    UPDATE "CoachMemory"
    SET "status" = 'DISMISSED', "updatedAt" = NOW()
    WHERE "id" = ${memoryId} AND "userId" = ${userId} AND "status" <> 'DISMISSED'
  `;
  return { dismissed: count > 0 };
}

/** The runner confirms a fact is still true, which resets its staleness clock. */
export async function confirmMemory(userId: string, memoryId: string): Promise<{ confirmed: boolean }> {
  const count = await getPrisma().$executeRaw`
    UPDATE "CoachMemory"
    SET "confirmedAt" = NOW(), "updatedAt" = NOW()
    WHERE "id" = ${memoryId} AND "userId" = ${userId} AND "status" = 'ACTIVE'
  `;
  return { confirmed: count > 0 };
}

/** Full deletion, for the runner's right to erase. */
export async function deleteAllMemory(userId: string): Promise<{ deleted: number }> {
  const deleted = await getPrisma().$executeRaw`DELETE FROM "CoachMemory" WHERE "userId" = ${userId}`;
  return { deleted };
}
