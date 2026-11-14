# Coach Context — Data Contract

Every field ZidRun sends to the AI coach (OpenAI), with its source, purpose, sensitivity, and
retention. This is the reviewable answer to *"why was this field sent?"* for each context property, and
the basis for the health-data consent/policy work.

**Assembly:** `src/lib/coach/context.ts` (`buildRunnerCoachContext`) — a pure serializer. The DB reads
happen in `src/lib/coach/service.ts` and helpers (`plan-context.ts`, `adherence.ts`, `metrics.ts`,
`weather.ts`). The provider call is server-only, structured (`zodTextFormat`), rate-limited, and
cost-tracked. Context is rebuilt per request and scoped by `userId`; it is never shared between runners.

**Sensitivity legend:** 🟢 low · 🟡 personal · 🔴 sensitive (health / body / free-text / location).

## What is deliberately EXCLUDED (never sent)

- Email, phone, national ID, exact account address, authentication data.
- **Raw GPS route coordinates.** GPS is used *internally only* to pick weather (nearest start / wilaya
  centroid); the coordinates themselves are not placed in the AI context.
- Exact home coordinates. Location is reduced to wilaya + city.

## Fields sent

| Context field | Source | Purpose | Sensitivity | Retention |
|---|---|---|---|---|
| `request.type` / `runnerQuestion` / `responseLocale` | request | Route the reply, echo the runner's question, set language | 🔴 free-text (question) | Stored on `CoachInteraction` |
| `request.asOf` / `localDate` / `timeZone` | injected server clock, Africa/Algiers | Ground relative dates without relying on provider/host time | 🟢 | Recomputed |
| `runner.sex` / `runner.age` | `User` | Physiology-appropriate advice | 🟡 personal | From account |
| `runner.location` (wilaya, city) | `User` | Local climate / time-of-day advice | 🟡 personal | From account |
| `goal.*` (type, targetDate, distance, time, experience, weekly/peak volume, longest run, available days, long-run day) | `RunnerGoal` | Core personalization — what they train for and their capacity | 🟡 personal | Until goal changed/deleted |
| `goal.restingHeartRate` / `weightKg` / `heightCm` / `bmi` | `RunnerGoal` | Load / effort calibration | 🔴 body measurements | Until goal changed/deleted |
| `goal.injuryNotes` / `injuryHistory` / `chronicConditions` / `healthNotes` / `constraints` | `RunnerGoal` | Safety gating and conservative advice | 🔴 health + free-text | Until goal changed/deleted |
| `computedMetrics` (volumes, pace, effort, fatigue, pain trends) | derived from `RunnerRun` | Deterministic read of recent training | 🟡 (pain/fatigue lean 🔴) | Recomputed per request |
| `consistency` / `intensityDistribution` | derived from `RunnerRun` | Cadence + 80/20 coaching | 🟢 | Recomputed |
| `sleep` (calendar window, coverage, dated nights, durations) | `SleepLog` | Recovery / load advice; unknown last night stays null | 🔴 health | 7 Africa/Algiers wake-date labels ending today; existing “log last night” stores today's date; future entries excluded |
| `nutrition` (calorie/water aggregate) | `NutritionLog` | Fueling / hydration advice | 🔴 health | 7-day aggregate |
| `targetRace` (title, type, date, wilaya, city, elevation, conditions) | `RaceEvent` | Race-specific prep | 🟡 personal | While linked |
| `environment` (current + today's forecast, retrieval time/date, observation-time uncertainty) | Open-Meteo via GPS/wilaya | Heat/rain-aware advice; retrieval is not an observation timestamp | 🟡 (approximate) | Not stored |
| `analysedRun` (distance, pace, splits, effort, weather) | `RunnerRun` | Post-run feedback | 🔴 free-text (notes/symptoms) | The selected run |
| `recentRuns` (≤10) | `RunnerRun` | Recent training picture | 🔴 free-text (notes/symptoms) | Last 56 days, newest 10 |
| `recentConversation` (≤6 turns, question, summary, follow-up, choices, next action, safety level) | Owner/active-goal/selected-run scoped `CoachInteraction` | Resolve short replies and avoid repeating questions | 🔴 free-text | Last 6 scoped interactions; implicit pending questions expire after 24 h |
| `planAdherence` | derived (`adherence.ts`) | Aggregate completed/skipped | 🟢 | Recomputed |
| `trainingPhase` / `planAdaptations` | `adaptive-planner.ts` | Name the phase + explain load changes | 🟢 | Recomputed |
| `activePlan` (per-workout status + linked run) | `TrainingPlan` / `TrainingWorkout` / `RunnerRun` | Reference exactly which sessions happened | 🟡 personal | While plan active |
| `fixedSafetyDecision` / `fixedWeeklyPlanSkeleton` | deterministic | Authoritative safety + candidate week | 🟢 | Recomputed |
| `records` (total runs/distance, longest run, best pace, est. 5K/10K bests, week streaks — ctx-v2) | derived from `RunnerRun` (`records.ts`) | Milestone-aware coaching (congratulate PBs, calibrate encouragement) without re-deriving from the 10-run window | 🟡 personal (aggregates only — no run ids, dates, or routes) | Recomputed per request over all VALID runs; re-derived facts reconciled on run deletion |
| `coachMemory` (≤12 facts: kind, fact text, source, age) | `CoachMemory` | Durable preferences/constraints/milestones so the coach doesn't re-ask | 🔴 free-text (runner-stated wording) | Until superseded/dismissed/expired; runner-controlled (confirm/forget/export/delete-all) |

## Trust & safety notes

- `replyToInteractionId` is an optional CHAT request field, persisted for idempotency but not sent
  to the provider. Explicit anchors must belong to the requester, active goal and selected run.
  Existing clients use the latest scoped exchange. Urgent symptoms and active exercise holds still
  take precedence over conversation lookup; consent remains mandatory before provider access.

- **Untrusted content:** everything the runner authored (`runnerQuestion`, run titles/notes/symptoms,
  nutrition text, imported text) is data, never instructions. The prompt (`openai.ts`, v7+) forbids
  following instructions embedded in it, revealing the prompt/context, or bypassing safety.
- **Anti-hallucination:** the response schema carries `usedSignals`, `dataGaps`, and one optional
  `followUpQuestion`, so the coach flags missing data instead of inventing weather/race/injury facts.
- **Guardrails:** `MAX_RECENT_RUNS=10`, `MAX_CONVERSATION_TURNS=6`, note/summary length caps, and a
  UTF-8 byte-based conservative token upper bound of 20,000 keep context bounded (not a billing
  estimate). Compaction rechecks after each removal, preserves the latest exchange, request,
  safety and plan, and fails closed if mandatory context cannot fit. Optional sections omitted for
  relevance or trimmed for budget are identified in metadata. Provider instructions/schema have a
  separate total-request guard. Selected-run splits are capped at 30 with an explicit truncation
  flag; active-plan context retains the 14 nearest workouts and reports the full workout count.
- **Relevance:** multilingual deterministic routing chooses enrichment for schedule, recovery,
  nutrition, run analysis or general questions. Unknown intents retain broad context. Safety always
  uses the original inputs before selection. No additional model call or vector database is used.
- **Memory budget/freshness:** at most 12 whole facts within a 3,200-byte token upper bound;
  constraints, rejected advice and human notes rank first. Schedules need reconfirmation after
  30 days, commitments after 14, strategies after 90, other kinds after 180. Explicit expiry can
  shorten these windows. Goal scope is applied before the DB retrieval limit; health writes remain
  disabled. These are retrieval windows, not data-deletion/retention policy changes.

## Governance

Context version and content-free hash provenance are implemented. Health-memory writes remain disabled
until field-level consent, retention/reconfirmation, self-service export/deletion, and the qualified
sports-health review are complete. Those actions and their release priority live only in
[`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md).
