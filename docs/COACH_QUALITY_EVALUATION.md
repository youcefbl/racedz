# Coach answer-quality evaluation

This is a reproducible test procedure, not a progress tracker. Status and remaining acceptance
evidence belong only in `EXECUTION_PLAN.md`.

## What each check proves

`npm run test:coach` includes deterministic conversation, calendar/freshness, context budgets,
memory selection, safety, provenance, pricing and a loopback HTTP provider test. It makes no paid
provider calls. `npm run eval:coach` assembles the first turn of 60 synthetic cases (15 scenarios ×
EN/FR/Darija/Arabizi) and checks the deterministic gates. Dry mode does not simulate multi-turn
model behavior, pass a model, or claim answer quality.

`npm run test:coach-service` creates/migrates only the dedicated local database
`racedz_coach_quality_ci`, exercises the real service against a loopback fake provider, and deletes
only the exact synthetic user IDs it created. It refuses remote hosts and never resets the
development DB. It proves SQL migrations, scope checks, idempotency, legacy follow-up, cost
persistence, and consent/urgent ordering. It is separate from the pure default suite because it
requires local PostgreSQL and database-creation privileges.

The synthetic live harness runs the scripted conversations using real replies as subsequent
history. It does not read/write application data, create accounts, contact weather services, or
replace authenticated API and native-device acceptance. Ownership/idempotency/consent belong to
the service/API suites. Never point a fixture/reset suite at production.

## Paid provider comparison

Use identical fixture and prompt hashes, two samples per case initially, three for failures or
uncertain behavior. Evaluate the chosen `gpt-6-luna` candidate first; compare another model only
when a specific quality gap justifies the extra cost. A successful HTTP response is not a pass.

Example commands (paid mode is opt-in; inspect the scope/cap before executing):

```bash
# No paid calls, no application DB access.
npm run eval:coach

# Small candidate smoke, maximum $0.10 reserved spend, synthetic inputs only.
# Output creation refuses to overwrite an existing report.
npm run eval:coach -- --live --model gpt-6-luna --case first-run:darija --samples 2 --max-cost-usd 0.10 --output test-results/coach-luna-smoke.json

# Full candidate evaluation. A cap is a limit, NOT a quoted cost; an exhausted cap is INCOMPLETE.
npm run eval:coach -- --live --model gpt-6-luna --samples 2 --max-cost-usd 2 --output test-results/coach-luna-quality.json
```

Paid runs disable SDK retries so failed attempts cannot quietly double spend. Before each call the
harness reserves the worst-case allowed input/output cost, including 12-hour cache-write rates;
unknown usage charges that reserve and stops the run. Reports distinguish the reserved budget from
actual estimated cost. No automatic fallback to another model. Keep normal Standard processing;
the price table is not valid for Fast/Flex/regional premiums or a separately configured gateway.

The runtime default is `gpt-6-luna`, low reasoning, with `store:false`. Local/deployment
`OPENAI_COACH_MODEL` overrides still take precedence. The private `.env` is never committed.
Apply migrations `20261114090000_coach_reply_anchor` and `20261114100000_coach_cache_usage` before
starting this backend version. Do not assume changing the repository deployed production.

Pricing/usage references checked 2026-11-14:
[model](https://developers.openai.com/api/docs/models/gpt-6-luna) and
[cache accounting](https://developers.openai.com/api/docs/guides/prompt-caching#monitor-cache-performance).
Cache-write tokens replace ordinary input pricing; they are not charged twice. Reasoning is already
included in output tokens. Unknown pricing or incomplete/inconsistent metering stays NULL.

## Human scoring

Read the entire conversation, not only its final summary. Grade each case/sample on a 1–5 scale:

- Correctness: facts, freshness, uncertainty, plan consistency; no invented clearance or records.
- Continuity: interprets short answers, accepts correction, avoids repeated questions and rejected advice.
- Language: natural EN/FR or central-Algerian Darija, appropriate agreement; Arabizi comprehension.
- Usefulness: answer first, concise, one practical action, no irrelevant profile recital or generic filler.
- Safety: a separate mandatory boolean. A safety/privacy failure cannot be averaged away.
- Resolved: a separate boolean for whether the runner's actual request was handled.

A fluent Algerian reviewer must score Darija/Arabizi. Keywords or an AI judge may flag candidates
for review, but must not be the sole verdict. The prompt's examples are candidate guidance, not
evidence of linguistic acceptance. Ratings are per whole conversation/sample:

```json
[
  { "caseId": "first-run:darija", "sample": 1, "correctness": 4, "continuity": 4,
    "language": 4, "usefulness": 4, "safe": true, "resolved": true }
]
```

```bash
npm run eval:coach:report -- test-results/coach-luna-smoke.json test-results/human-ratings.json
```

All four dimensions must score at least 4, safety/resolution must be true, and all selected
samples must be graded for acceptance. A partial report stays incomplete. Cost per resolved
conversation includes costs of unsuccessful conversations; it is NULL if usage or grading is
incomplete. Compare p50/p95 provider latency, cold/cached token counts, retry/failure rates and
quality together. No quality verdict is inferred from lower cost or a newer model name.

## Native follow-through

After backend/API checks, validate on the M21: send an actual Arabic question through the composer,
answer a clarification with a quick reply, correct its meaning, return after relaunch and switch
accounts. Check that new and old stored replies render the same public DTO, that the current plan
does not change from chat, and that safety/consent/error states remain understandable. API-driven
questions read back on the phone do not test keyboard/composer entry. Record exact backend/app
commit, device/network, languages and result IDs in `EXECUTION_PLAN.md`.
