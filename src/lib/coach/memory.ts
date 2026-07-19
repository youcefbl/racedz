import type { CoachMemoryKind, CoachMemorySource, CoachMemoryStatus } from "@prisma/client";

/**
 * Structured long-term coaching memory (Phase 3).
 *
 * The point of this module is that the coach does NOT get an ever-growing chat transcript. It gets a
 * small set of sourced, timestamped facts, selected for relevance and capped by a budget. Everything
 * here is pure so the selection rules can be tested without a database.
 */

// ── The health-data gate ─────────────────────────────────────────────────────

/**
 * Kinds the application is allowed to write today.
 *
 * INJURY_STATUS and RECOVERY_STATUS are deliberately absent. Storing health data requires the
 * privacy/consent/retention policy line that execution-plan-coach.md tracks as a Phase 0 blocker
 * (what is stored, the consent model, retention and expiry, deletion). The enum values exist so the
 * schema does not need another migration when the policy lands, but until then every write path
 * refuses them — a runner's injury history must not be silently accumulated because a model inferred
 * one from a chat message.
 */
export const WRITABLE_MEMORY_KINDS = [
  "PREFERENCE",
  "COACHING_TONE",
  "SCHEDULE",
  "TERRAIN",
  "CONSTRAINT",
  "COMMITMENT",
  "STRATEGY_WORKED",
  "STRATEGY_FAILED",
  "REJECTED_SUGGESTION",
  "COACH_NOTE"
] as const satisfies readonly CoachMemoryKind[];

export type WritableMemoryKind = (typeof WRITABLE_MEMORY_KINDS)[number];

const WRITABLE = new Set<string>(WRITABLE_MEMORY_KINDS);

/** Health kinds are blocked pending the policy line; everything else is writable. */
export function isWritableMemoryKind(kind: string): kind is WritableMemoryKind {
  return WRITABLE.has(kind);
}

// Kinds the model is allowed to propose from a conversation. Narrower than WRITABLE_MEMORY_KINDS:
// COACH_NOTE is for humans, and REJECTED_SUGGESTION / STRATEGY_* are written by the app from real
// outcomes rather than inferred from what the model thinks it heard.
export const AI_PROPOSABLE_MEMORY_KINDS = ["PREFERENCE", "COACHING_TONE", "SCHEDULE", "TERRAIN", "CONSTRAINT", "COMMITMENT"] as const;

const AI_PROPOSABLE = new Set<string>(AI_PROPOSABLE_MEMORY_KINDS);

export function isAiProposableMemoryKind(kind: string): boolean {
  return AI_PROPOSABLE.has(kind);
}

// ── Shapes ───────────────────────────────────────────────────────────────────

export type MemoryRecord = {
  id: string;
  goalId: string | null;
  kind: CoachMemoryKind;
  key: string;
  value: string;
  source: CoachMemorySource;
  confidence: number | null;
  status: CoachMemoryStatus;
  confirmedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// What the AI context sees. Deliberately narrow: no ids, no interaction references, no raw timestamps
// beyond a coarse age — the coach needs the fact and how much to trust it, nothing else.
export type MemoryContextItem = {
  kind: CoachMemoryKind;
  fact: string;
  // RUNNER_STATED facts are things the runner told us; AI_INFERRED are the coach's own guesses and must
  // never be replayed as though the runner said them.
  source: CoachMemorySource;
  ageDays: number;
};

// ── Retrieval ────────────────────────────────────────────────────────────────

// Memory competes with runs, plans and metrics for prompt space, so it is capped. Phase 3's rule is
// "retrieve the most relevant within budget", not "append everything".
export const MEMORY_CONTEXT_LIMIT = 12;

// A fact this old that has never been reconfirmed is more likely stale than useful.
export const MEMORY_STALE_AFTER_DAYS = 180;

const KIND_PRIORITY: Record<CoachMemoryKind, number> = {
  // Constraints and rejected advice change what the coach must NOT say, so they outrank preferences.
  CONSTRAINT: 0,
  REJECTED_SUGGESTION: 1,
  COACH_NOTE: 2,
  COMMITMENT: 3,
  SCHEDULE: 4,
  PREFERENCE: 5,
  COACHING_TONE: 6,
  TERRAIN: 7,
  STRATEGY_WORKED: 8,
  STRATEGY_FAILED: 9,
  INJURY_STATUS: 10,
  RECOVERY_STATUS: 11
};

const SOURCE_PRIORITY: Record<CoachMemorySource, number> = {
  RUNNER_STATED: 0,
  HUMAN_COACH: 1,
  SYSTEM_DERIVED: 2,
  AI_INFERRED: 3
};

function ageInDays(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}

/** A memory is usable if it is active, not expired, and not so old it should be reconfirmed first. */
export function isUsableMemory(record: MemoryRecord, now: Date): boolean {
  if (record.status !== "ACTIVE") return false;
  if (record.expiresAt !== null && record.expiresAt.getTime() <= now.getTime()) return false;
  // A fact the runner has reconfirmed stays fresh from the confirmation, not from when it was learned.
  const lastAffirmed = record.confirmedAt ?? record.createdAt;
  if (ageInDays(lastAffirmed, now) > MEMORY_STALE_AFTER_DAYS) return false;
  return true;
}

/**
 * Select the memory to send with a request.
 *
 * Ordering: usable only, facts scoped to the current goal (or global) only, then by kind priority,
 * then runner-stated before AI-inferred, then most recently affirmed first. Truncated to the budget.
 */
export function selectMemoryForContext(
  records: MemoryRecord[],
  options: { goalId: string | null; now: Date; limit?: number }
): MemoryContextItem[] {
  const { goalId, now } = options;
  const limit = options.limit ?? MEMORY_CONTEXT_LIMIT;

  return records
    .filter((record) => isUsableMemory(record, now))
    // A fact tied to a previous goal must not leak into the current one — old goals contaminating the
    // current picture is exactly what Phase 3's exit criteria call out.
    .filter((record) => record.goalId === null || record.goalId === goalId)
    .sort((a, b) => {
      const byKind = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
      if (byKind !== 0) return byKind;
      const bySource = SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
      if (bySource !== 0) return bySource;
      const aAffirmed = (a.confirmedAt ?? a.createdAt).getTime();
      const bAffirmed = (b.confirmedAt ?? b.createdAt).getTime();
      return bAffirmed - aAffirmed;
    })
    .slice(0, limit)
    .map((record) => ({
      kind: record.kind,
      fact: record.value,
      source: record.source,
      ageDays: ageInDays(record.confirmedAt ?? record.createdAt, now)
    }));
}

// ── Write-side validation ────────────────────────────────────────────────────

export const MEMORY_KEY_MAX = 64;
export const MEMORY_VALUE_MAX = 300;

export type MemoryWriteCandidate = {
  kind: string;
  key: string;
  value: string;
  source: CoachMemorySource;
  goalId?: string | null;
  confidence?: number | null;
  sourceInteractionId?: string | null;
  expiresAt?: Date | null;
};

export type MemoryWriteRejection = { candidate: MemoryWriteCandidate; reason: string };

/**
 * Validate candidates before they reach the database.
 *
 * This is the enforcement point for the memory-quality rules: health kinds are refused outright, the
 * model may only propose a narrow subset of kinds, AI inferences must carry a confidence, and free
 * text is length-bounded so a prompt-injected payload cannot be stored wholesale and replayed into
 * every future request.
 */
export function validateMemoryCandidates(
  candidates: MemoryWriteCandidate[],
  now: Date
): { accepted: MemoryWriteCandidate[]; rejected: MemoryWriteRejection[] } {
  const accepted: MemoryWriteCandidate[] = [];
  const rejected: MemoryWriteRejection[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const reject = (reason: string) => rejected.push({ candidate, reason });

    if (!isWritableMemoryKind(candidate.kind)) {
      reject(
        candidate.kind === "INJURY_STATUS" || candidate.kind === "RECOVERY_STATUS"
          ? "health kinds are blocked pending the health-data policy"
          : "unknown memory kind"
      );
      continue;
    }
    if (candidate.source === "AI_INFERRED" && !isAiProposableMemoryKind(candidate.kind)) {
      reject("the model may not propose this kind");
      continue;
    }
    if (candidate.source === "AI_INFERRED" && (candidate.confidence === null || candidate.confidence === undefined)) {
      reject("AI-inferred memory must carry a confidence");
      continue;
    }
    const key = candidate.key.trim();
    const value = candidate.value.trim();
    if (key.length === 0 || key.length > MEMORY_KEY_MAX) {
      reject("key is empty or too long");
      continue;
    }
    if (value.length === 0 || value.length > MEMORY_VALUE_MAX) {
      reject("value is empty or too long");
      continue;
    }
    if (candidate.expiresAt && candidate.expiresAt.getTime() <= now.getTime()) {
      reject("already expired");
      continue;
    }
    // Two candidates for the same slot in one batch: keep the first, so a single reply cannot write a
    // fact and immediately contradict it.
    const slot = `${candidate.kind}:${key}`;
    if (seen.has(slot)) {
      reject("duplicate key in the same batch");
      continue;
    }
    seen.add(slot);

    accepted.push({ ...candidate, key, value });
  }

  return { accepted, rejected };
}
