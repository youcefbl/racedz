/**
 * What a re-used Coach request id means for the interaction already stored under it.
 *
 * This file exists because the stale-PENDING reclamation was dead code for its entire life, and
 * nothing noticed. `prior` is a plain object read BEFORE the reclaiming UPDATE, and its in-memory
 * `status` was never corrected afterwards — so the very next branch still saw "PENDING", took the
 * replay path, and returned `status: "PENDING"` with a null response. Every client renders that as
 * "still generating". The one request that had genuinely lost its worker could therefore never be
 * retried, by anyone, ever.
 *
 * It survived review twice because the decision lived inside `createCoachInteraction`, which needs
 * a database, an active goal, an entitlement and a provider before it will run a single line. The
 * logic is now a pure function, so the case can actually be asserted.
 *
 *   npm run test:coach-idempotency
 */
import { classifyPriorInteraction, isPendingLeaseStale } from "../src/lib/coach/service";

let passed = 0;
let failed = 0;
const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${label} — ${detail}`);
  if (cond) passed += 1;
  else failed += 1;
};

const NOW = new Date("2026-08-16T12:00:00.000Z");
const STALE_BEFORE = new Date(NOW.getTime() - 5 * 60_000);

const chat = { type: "CHAT", runId: null, message: "How should I taper?" };
const prior = (over: Partial<Parameters<typeof classifyPriorInteraction>[0]> = {}) => ({
  status: "PENDING",
  type: "CHAT",
  runId: null as string | null,
  userMessage: "How should I taper?",
  claimedAt: null as Date | null,
  ...over
});

// ---- The regression ---------------------------------------------------------------------------
check(
  "a PENDING row with a dead lease is reclaimed, not reported as in progress",
  classifyPriorInteraction(prior({ claimedAt: new Date(NOW.getTime() - 30 * 60_000) }), chat, STALE_BEFORE).kind ===
    "RECLAIM_STALE",
  "worker died 30 minutes ago"
);
check(
  "a reclaimed row is never replayed — replay would hand back a null response as if it were an answer",
  classifyPriorInteraction(prior({ claimedAt: new Date(NOW.getTime() - 30 * 60_000) }), chat, STALE_BEFORE).kind !== "REPLAY",
  "RECLAIM_STALE is distinct from REPLAY"
);
check(
  "a PENDING row with a live lease is still in progress",
  classifyPriorInteraction(prior({ claimedAt: new Date(NOW.getTime() - 30_000) }), chat, STALE_BEFORE).kind === "IN_PROGRESS",
  "claimed 30 seconds ago"
);
check(
  "a PENDING row that never recorded a lease is stale, not in progress",
  classifyPriorInteraction(prior({ claimedAt: null }), chat, STALE_BEFORE).kind === "RECLAIM_STALE",
  "no worker can be waiting on a lease that was never taken"
);

// ---- The lease boundary itself ----------------------------------------------------------------
check("a lease exactly at the cutoff is NOT yet stale", !isPendingLeaseStale(STALE_BEFORE, STALE_BEFORE), "inclusive boundary");
check(
  "a lease one millisecond past the cutoff is stale",
  isPendingLeaseStale(new Date(STALE_BEFORE.getTime() - 1), STALE_BEFORE),
  "strictly older"
);
check("a null lease is stale", isPendingLeaseStale(null, STALE_BEFORE), "treated as epoch");

// ---- The surrounding contract, so the refactor cannot quietly change it ------------------------
check(
  "a COMPLETED row replays",
  classifyPriorInteraction(prior({ status: "COMPLETED" }), chat, STALE_BEFORE).kind === "REPLAY",
  "stored answer returned verbatim"
);
check(
  "a BLOCKED row replays",
  classifyPriorInteraction(prior({ status: "BLOCKED" }), chat, STALE_BEFORE).kind === "REPLAY",
  "a safety block is an answer too"
);
check(
  "a FAILED row is retried on the same row",
  classifyPriorInteraction(prior({ status: "FAILED" }), chat, STALE_BEFORE).kind === "RETRY_FAILED",
  "one logical interaction in the runner's history"
);
check(
  "the same key with a different message is a mismatch, not a replay",
  classifyPriorInteraction(prior({ status: "COMPLETED" }), { ...chat, message: "Something else" }, STALE_BEFORE).kind ===
    "MISMATCH",
  "a key names one logical request (B83-R05)"
);
check(
  "the same key with a different type is a mismatch",
  classifyPriorInteraction(prior({ status: "COMPLETED" }), { ...chat, type: "POST_RUN" }, STALE_BEFORE).kind === "MISMATCH",
  "CHAT is not POST_RUN"
);
check(
  "the same key against a different run is a mismatch",
  classifyPriorInteraction(
    prior({ status: "COMPLETED", type: "POST_RUN", userMessage: null }),
    { type: "POST_RUN", runId: "run-b", message: null },
    STALE_BEFORE
  ).kind === "MISMATCH",
  "run-a's analysis must not replay for run-b"
);
check(
  "mismatch is decided before staleness — a wrong payload is never reclaimed",
  classifyPriorInteraction(
    prior({ claimedAt: new Date(NOW.getTime() - 30 * 60_000) }),
    { ...chat, message: "A different question" },
    STALE_BEFORE
  ).kind === "MISMATCH",
  "otherwise a stale row could be hijacked by a different question on the same key"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
