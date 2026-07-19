import {
  isWritableMemoryKind,
  selectMemoryForContext,
  validateMemoryCandidates,
  MEMORY_CONTEXT_LIMIT,
  MEMORY_STALE_AFTER_DAYS,
  MEMORY_VALUE_MAX,
  type MemoryRecord,
  type MemoryWriteCandidate
} from "@/lib/coach/memory";

// Deterministic checks on long-term coaching memory (Phase 3). No database, no network — the
// selection and validation rules are pure so the guarantees that matter (health gate, goal scoping,
// staleness, provenance) can be pinned exactly.

const NOW = new Date("2026-07-19T09:00:00.000Z");
const GOAL = "goal-current";
let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) passed += 1;
  else failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function record(over: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: `m-${Math.round((over.createdAt ?? NOW).getTime())}-${over.key ?? "k"}`,
    goalId: null,
    kind: "PREFERENCE",
    key: "k",
    value: "a fact",
    source: "RUNNER_STATED",
    confidence: null,
    status: "ACTIVE",
    confirmedAt: null,
    expiresAt: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    ...over
  };
}

// ── The health gate ──────────────────────────────────────────────────────────
// Storing health data needs the privacy/consent/retention policy line that is still an open blocker.
// Until it exists, no write path may accept it — regardless of who proposes it.
{
  check("injury status is not writable", !isWritableMemoryKind("INJURY_STATUS"));
  check("recovery status is not writable", !isWritableMemoryKind("RECOVERY_STATUS"));
  check("ordinary preferences are writable", isWritableMemoryKind("PREFERENCE"));

  const health: MemoryWriteCandidate[] = [
    { kind: "INJURY_STATUS", key: "knee", value: "runner has a bad left knee", source: "RUNNER_STATED" },
    { kind: "RECOVERY_STATUS", key: "state", value: "recovering from shin splints", source: "SYSTEM_DERIVED" }
  ];
  const result = validateMemoryCandidates(health, NOW);
  check("health candidates are all rejected", result.accepted.length === 0, `accepted ${result.accepted.length}`);
  check(
    "health rejections say why",
    result.rejected.every((r) => /health kinds are blocked/.test(r.reason)),
    JSON.stringify(result.rejected.map((r) => r.reason))
  );
}

// ── What the model may propose ───────────────────────────────────────────────
{
  const overreach: MemoryWriteCandidate[] = [
    // The model must not be able to decide by itself that the runner rejected something, nor write
    // notes attributed to a human coach.
    { kind: "REJECTED_SUGGESTION", key: "x", value: "no morning runs", source: "AI_INFERRED", confidence: 0.9 },
    { kind: "COACH_NOTE", key: "y", value: "seems unmotivated", source: "AI_INFERRED", confidence: 0.5 },
    { kind: "STRATEGY_FAILED", key: "z", value: "tempo work", source: "AI_INFERRED", confidence: 0.5 }
  ];
  const result = validateMemoryCandidates(overreach, NOW);
  check("the model cannot propose rejected-suggestion, coach-note or strategy facts", result.accepted.length === 0, `accepted ${result.accepted.length}`);

  // The app may write those same kinds, because they come from real actions rather than inference.
  const appWritten = validateMemoryCandidates(
    [{ kind: "REJECTED_SUGGESTION", key: "x", value: "no morning runs", source: "SYSTEM_DERIVED" }],
    NOW
  );
  check("the app can record a rejected suggestion from a real action", appWritten.accepted.length === 1);

  const noConfidence = validateMemoryCandidates([{ kind: "PREFERENCE", key: "p", value: "likes trails", source: "AI_INFERRED" }], NOW);
  check("an AI inference without a confidence is rejected", noConfidence.accepted.length === 0);
}

// ── Input bounds ─────────────────────────────────────────────────────────────
{
  const oversized = "x".repeat(MEMORY_VALUE_MAX + 1);
  const result = validateMemoryCandidates(
    [
      { kind: "PREFERENCE", key: "a", value: oversized, source: "RUNNER_STATED" },
      { kind: "PREFERENCE", key: "", value: "fine", source: "RUNNER_STATED" },
      { kind: "PREFERENCE", key: "b", value: "   ", source: "RUNNER_STATED" },
      { kind: "PREFERENCE", key: "c", value: "kept", source: "RUNNER_STATED" }
    ],
    NOW
  );
  // Bounded free text matters beyond tidiness: an injected payload stored whole would be replayed
  // into every future request.
  check("oversized, empty and blank values are rejected", result.accepted.length === 1, `accepted ${result.accepted.length}`);
  check("the valid candidate survives", result.accepted[0]?.value === "kept");
  check("values are trimmed", validateMemoryCandidates([{ kind: "PREFERENCE", key: " k ", value: " v ", source: "RUNNER_STATED" }], NOW).accepted[0]?.key === "k");

  const conflicting = validateMemoryCandidates(
    [
      { kind: "SCHEDULE", key: "preferred_time", value: "mornings", source: "RUNNER_STATED" },
      { kind: "SCHEDULE", key: "preferred_time", value: "evenings", source: "RUNNER_STATED" }
    ],
    NOW
  );
  check("a batch cannot write then contradict the same slot", conflicting.accepted.length === 1, `accepted ${conflicting.accepted.length}`);
  check("the first value wins", conflicting.accepted[0]?.value === "mornings");

  const expired = validateMemoryCandidates(
    [{ kind: "PREFERENCE", key: "k", value: "v", source: "RUNNER_STATED", expiresAt: daysAgo(1) }],
    NOW
  );
  check("an already-expired candidate is rejected", expired.accepted.length === 0);
}

// ── Retrieval: what reaches the prompt ───────────────────────────────────────
{
  const records: MemoryRecord[] = [
    record({ key: "active", value: "runs before work", kind: "SCHEDULE" }),
    record({ key: "superseded", value: "old value", status: "SUPERSEDED" }),
    record({ key: "dismissed", value: "runner removed this", status: "DISMISSED" }),
    record({ key: "expired", value: "no longer true", expiresAt: daysAgo(1) }),
    record({ key: "stale", value: "learned long ago", createdAt: daysAgo(MEMORY_STALE_AFTER_DAYS + 5) }),
    record({ key: "reconfirmed", value: "old but reconfirmed", createdAt: daysAgo(MEMORY_STALE_AFTER_DAYS + 5), confirmedAt: daysAgo(2) })
  ];
  const selected = selectMemoryForContext(records, { goalId: GOAL, now: NOW });
  const facts = selected.map((item) => item.fact);

  check("active facts are retrieved", facts.includes("runs before work"));
  check("superseded facts are not retrieved", !facts.includes("old value"));
  check("dismissed facts are never retrieved", !facts.includes("runner removed this"));
  check("expired facts are not retrieved", !facts.includes("no longer true"));
  check("stale facts are not retrieved", !facts.includes("learned long ago"));
  check("reconfirming a fact makes it fresh again", facts.includes("old but reconfirmed"));
}

// Old goals must not contaminate the current one — a Phase 3 exit criterion.
{
  const records: MemoryRecord[] = [
    record({ key: "global", value: "global fact", goalId: null }),
    record({ key: "current", value: "current-goal fact", goalId: GOAL }),
    record({ key: "old", value: "retired-goal fact", goalId: "goal-old" })
  ];
  const facts = selectMemoryForContext(records, { goalId: GOAL, now: NOW }).map((item) => item.fact);
  check("global facts apply to every goal", facts.includes("global fact"));
  check("current-goal facts are retrieved", facts.includes("current-goal fact"));
  check("a previous goal's facts do not leak into the current one", !facts.includes("retired-goal fact"));
}

// Budget and priority: what survives truncation is what changes the advice.
{
  const many: MemoryRecord[] = [
    ...Array.from({ length: MEMORY_CONTEXT_LIMIT + 10 }, (_, i) =>
      record({ key: `pref-${i}`, value: `preference ${i}`, kind: "PREFERENCE", createdAt: daysAgo(10) })
    ),
    record({ key: "constraint", value: "cannot run on Fridays", kind: "CONSTRAINT", createdAt: daysAgo(30) }),
    record({ key: "rejected", value: "suggested 5am runs", kind: "REJECTED_SUGGESTION", createdAt: daysAgo(30) })
  ];
  const selected = selectMemoryForContext(many, { goalId: GOAL, now: NOW });
  const facts = selected.map((item) => item.fact);

  check("retrieval respects the context budget", selected.length === MEMORY_CONTEXT_LIMIT, `${selected.length} items`);
  check("constraints survive truncation", facts.includes("cannot run on Fridays"));
  check("rejected advice survives truncation", facts.includes("suggested 5am runs"));
  check("constraints outrank preferences", facts[0] === "cannot run on Fridays", facts[0]);
}

// Provenance must reach the prompt: an inference must never be replayed as something the runner said.
{
  const records: MemoryRecord[] = [
    record({ key: "stated", value: "I hate treadmills", source: "RUNNER_STATED", kind: "PREFERENCE" }),
    record({ key: "guessed", value: "probably prefers trails", source: "AI_INFERRED", confidence: 0.6, kind: "PREFERENCE" })
  ];
  const selected = selectMemoryForContext(records, { goalId: GOAL, now: NOW });
  check("every retrieved fact carries its source", selected.every((item) => Boolean(item.source)));
  check("runner-stated facts outrank the coach's own guesses", selected[0]?.source === "RUNNER_STATED");
  check("age is exposed so the coach can hedge on old facts", selected.every((item) => typeof item.ageDays === "number"));
  check(
    "no identifiers reach the prompt",
    selected.every((item) => !("id" in item) && !("sourceInteractionId" in item)),
    JSON.stringify(Object.keys(selected[0] ?? {}))
  );
}

console.log(`coach memory: ${passed}/${passed + failures.length} checks passed`);
if (failures.length > 0) {
  console.error("\nFAILED:");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exitCode = 1;
}
