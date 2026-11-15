import assert from "node:assert/strict";
import { isUsableMemory, selectMemoryForContext, MEMORY_TOKEN_UPPER_BOUND, type MemoryRecord } from "../src/lib/coach/memory";
import { jsonTokenUpperBound } from "../src/lib/coach/context-budget";
const now = new Date("2026-11-14T12:00:00Z");
const memory = (kind: MemoryRecord["kind"], age: number, value = "a fact"): MemoryRecord => ({
  id: kind, goalId: null, kind, key: kind, value, source: "RUNNER_STATED", confidence: null,
  status: "ACTIVE", confirmedAt: null, expiresAt: null,
  createdAt: new Date(now.getTime() - age * 86_400_000), updatedAt: now
});
assert.equal(isUsableMemory(memory("SCHEDULE", 31), now), false);
assert.equal(isUsableMemory(memory("COMMITMENT", 15), now), false);
assert.equal(isUsableMemory(memory("PREFERENCE", 31), now), true);
assert.equal(isUsableMemory({ ...memory("SCHEDULE", 60), confirmedAt: now }, now), true);
const selected = selectMemoryForContext([memory("PREFERENCE", 1), memory("SCHEDULE", 1), memory("CONSTRAINT", 1)],
  { goalId: "g1", now, intent: "SCHEDULE", limit: 2 });
assert.deepEqual(selected.map((fact) => fact.kind), ["CONSTRAINT", "SCHEDULE"]);
const huge = selectMemoryForContext(Array.from({ length: 12 }, () => memory("COACH_NOTE", 1, "ع".repeat(1000))), { goalId: "g1", now });
assert.ok(jsonTokenUpperBound(huge) <= MEMORY_TOKEN_UPPER_BOUND);
const ordinary = { ...memory("PREFERENCE", 1, "I prefer evening runs"), id: "ordinary" };
const stopwordTrap = { ...memory("PREFERENCE", 1, "the and what"), id: "trap" };
assert.deepEqual(selectMemoryForContext([ordinary, stopwordTrap],
  { goalId: "g1", now, intent: "GENERAL", question: "what and the", limit: 2 }).map((fact) => fact.fact),
  [ordinary.value, stopwordTrap.value], "common question words must not manufacture lexical relevance");
const trail = { ...memory("PREFERENCE", 1, "I prefer trail running"), id: "trail" };
assert.equal(selectMemoryForContext([ordinary, trail],
  { goalId: "g1", now, intent: "GENERAL", question: "What is my trail preference?", limit: 1 })[0]?.fact,
  trail.value, "meaningful whole-word overlap still improves relevance");
console.log("PASS — relevant memory, type-specific freshness, confirmation and bounded Arabic facts");
