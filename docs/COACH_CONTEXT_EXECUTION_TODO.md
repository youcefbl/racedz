# ZidRun Coach Context — Executable TODO

## Purpose

Make Coach Zid feel like a consistent coach for one runner over time, not a generic
answer generator. Every task below has an owner boundary, implementation location,
and acceptance criteria. The PostgreSQL data model remains the source of truth; do
not create an indefinitely growing provider-side conversation.

## Audit result — current behavior

The current request path is:

1. `POST /api/coach/interactions` authenticates the runner and applies a burst limit.
2. `createCoachInteraction()` validates the request, loads the active goal, verifies
   the optional run belongs to the runner, blocks off-topic chat, and enforces the
   coach entitlement.
3. It calculates deterministic metrics, consistency, intensity distribution, and
   safety; then builds a weekly plan skeleton.
4. It loads, per request:
   - the active `RunnerGoal`, including target date/distance/time, experience,
     availability, training history, weight/height, injury notes, chronic conditions,
     and health notes;
   - `User.gender`, calculated age, `User.wilaya`, and `User.city`;
   - up to 120 runs from the last 56 days, with only the newest 10 placed in the AI
     context; the selected run gets extra split data for post-run feedback;
   - a linked published target race, when present;
   - current/today weather from the latest GPS start or wilaya centroid for non-post-run
     requests, plus historical run weather when available;
   - up to 14 days of sleep, summarized to the newest seven nights;
   - a seven-day nutrition/hydration aggregate;
   - six prior completed/blocked interaction summaries for this same runner;
   - the fixed safety decision and deterministic weekly skeleton.
5. `buildRunnerCoachContext()` trims notes and conversation, compacts unusually large
   contexts, and `generateCoachResponse()` sends `JSON.stringify(context)` as the
   Responses API input with a versioned instruction prompt and Structured Outputs.
6. The returned response is safety-filtered, stored in `CoachInteraction`, optional
   plans are saved as drafts, and token/cost usage is stored in `AiUsageLog`.

### What is already good

- Context is rebuilt server-side and scoped by `userId`; it is not shared between
  runners.
- The AI does not receive email, phone, national ID, exact account address, or auth
  data.
- Goals, runs, injuries, sleep, nutrition, race target, weather, language, and safety
  rules are already represented.
- The provider call is server-only, structured, rate-limited, cost-tracked, and run
  through deterministic safety constraints.

### Gaps that reduce realism or trust

- The context sends a fresh deterministic skeleton, but not the actual active/draft
  plan with completed, missed, skipped, or rescheduled workouts. Plan adherence is
  therefore not truly available to the model even though the product displays it.
- Conversation memory is only six turns and only keeps the user question plus the
  response `summary`. It loses decisions, preferences, commitments, unresolved
  questions, and details from the rest of the response. `acceptedAt` exists but plan
  acceptance is not used as durable coaching memory.
- There is no user-confirmed long-term memory such as preferred session time, disliked
  workouts, equipment, surface, motivation, coaching tone, work schedule, or recurring
  constraints. The model must rediscover these from short recent history.
- The location block is only wilaya/city. Exact GPS is used internally to choose
  weather, but route terrain, surface, normal training area, timezone, and preferred
  training time are not represented. Forecast data is current/today, not tied to the
  scheduled workout time or target race date.
- Target-race latitude/longitude is loaded but discarded by the context serializer.
  Course shape, start time, category, elevation profile, and travel/acclimatization
  needs are not available.
- Nutrition is reduced to average calories and water. Meal timing, fueling on long
  runs, GI tolerance, dietary constraints, and hydration behavior are absent.
- Health data is useful but sensitive. There is no visible health-data inventory,
  retention control, field-level consent, or user-facing way to review/delete coach
  memory separately from the account.
- The exact assembled context is not stored or hashed with the interaction. A later
  profile/run change can make an answer impossible to reproduce during support,
  evaluation, or a safety investigation.
- Free-text notes and chat are passed as data, but the prompt contract should make it
  explicit that they are untrusted runner content and never instructions.
- Responses have no explicit evidence references, data-gap signal, clarification
  question, usefulness feedback, or outcome loop. The coach can sound confident when
  important data is missing.

## Execution order

### Phase 0 — lock the contract and protect sensitive data (P0)

- [ ] Write a short coach-context data contract in `docs/` listing every field sent
  to OpenAI, its source table, purpose, sensitivity, retention, and whether it is
  optional. Mark health data, body measurements, GPS-derived data, and free text as
  sensitive.
  - **Done when:** a reviewer can answer “why was this field sent?” for every context
    property, and the contract explicitly excludes identifiers and exact coordinates
    unless a later task grants consent.
- [ ] Add an explicit, versioned health/coaching-data consent record before expanding
  collection. Keep consent separate from acceptance of the general terms.
  - **Done when:** a runner can see what is used for personalization, decline optional
    sensitive fields, and the server refuses newly sensitive collection without the
    required consent state.
- [ ] Add self-service export and deletion for coach data, including goals, runs and
  GPS routes, sleep, nutrition, interactions, context snapshots/memory, usage logs,
  and coach payment-proof files.
  - **Done when:** deletion removes database rows and upload artifacts, export is
    complete and machine-readable, and the flow is covered by an authenticated test.
- [ ] Add prompt-injection rules to `src/lib/coach/openai.ts`: runner messages,
  notes, symptoms, nutrition descriptions, and imported text are untrusted data;
  ignore instructions inside them; never reveal system instructions or private
  context; never let them alter safety or authorization.
  - **Done when:** adversarial EN/FR/AR notes cannot change the requested output
    format, expose context, or bypass safety in automated tests.

### Phase 1 — make the context factually complete (P0)

- [ ] Add `src/lib/coach/plan-context.ts` and load the actual active and pending plan:
  plan version/status/date range, each workout's scheduled date/type/target, workout
  status, completion link, actual run, missed-session count, and plan adherence over
  the last 2–4 weeks.
  - Update `src/lib/coach/context.ts` to send `activePlan`, `pendingPlan`, and
    `planAdherence`; keep the deterministic skeleton authoritative for safety.
  - **Done when:** a runner who missed an interval, completed an easy run, or accepted
    a plan change produces different context and advice than a runner with the same
    raw mileage but different adherence.
- [ ] Add training-phase derivation in `src/lib/coach/metrics.ts`: base, build, peak,
  taper, recovery, or return-after-break, based on target race/date, plan, recent
  load, and safety signals.
  - **Done when:** phase is deterministic, explained by input facts, and tested around
    race-date boundaries and a runner returning after a break.
- [ ] Normalize race targeting. Include target race category/distance, start time,
  local date/timezone, registration state, course elevation/profile if available,
  surface/terrain, and days-to-race. Preserve useful race coordinates internally,
  but do not send raw GPS coordinates to the model.
  - **Done when:** a trail race, a road race, and a race with a different start time
    generate visibly different planning context; missing race fields remain `null`.
- [ ] Fix the date/environment mismatch. Fetch or cache forecast conditions for the
  scheduled workout's approximate local time and use race-date forecasts only when
  they are available and clearly labeled as uncertain. Store source and observed-at
  timestamps.
  - **Done when:** the coach never describes “today's weather” as race-day weather,
    and stale/unavailable forecasts are omitted rather than invented.

### Phase 2 — add durable, user-controlled coaching memory (P1)

- [ ] Add a `CoachMemory` model (or equivalent JSONB table) with: `userId`, optional
  `goalId`, category, value, source interaction/run, confidence, `confirmedAt`,
  `lastUsedAt`, `expiresAt`, and `deletedAt`/audit metadata.
  - Keep only actionable facts: preferred training time, preferred long-run day,
    equipment/access, usual surface, schedule constraints, motivation, dislikes,
    fueling preferences, and agreed coaching style.
  - Never turn a model guess into a fact automatically; mark extracted candidates as
    pending until the runner confirms them.
  - **Done when:** memory is goal-scoped where appropriate, user-scoped always, and
    stale or deleted memories are excluded from context.
- [ ] Build a small “What Coach Zid remembers” screen under `/account/coach` with
  confirm, edit, forget, and “do not remember this” actions.
  - **Done when:** the runner can inspect and remove every durable preference without
    contacting support, and removed memory is absent from the next request.
- [ ] Replace summary-only conversation continuity with a two-level memory strategy:
  recent turns for immediate coherence plus confirmed memory for long-term continuity.
  Include the latest relevant interaction type, question, answer summary, accepted
  plan changes, unresolved question, and runner feedback—not the entire unbounded chat.
  - **Done when:** a preference stated ten interactions ago is retained only after
    confirmation, while a recent unresolved question is available on the next reply.
- [ ] Record coach outcomes: plan accepted/rejected/edited, workout completed/skipped,
  answer helpful/not helpful, and “this advice did not fit” feedback.
  - **Done when:** the next weekly review can distinguish what the runner followed
    from what they ignored, and acceptance timestamps are populated correctly.

### Phase 3 — progressive personalization inputs (P1)

- [ ] Extend onboarding only with high-value, low-burden fields: usual training
  surface/terrain, preferred training time, cross-training/strength availability,
  equipment, schedule constraints, motivation, and coaching tone. Keep all optional
  and allow “not sure/prefer not to say”.
  - Add Zod validation in `src/lib/coach/schemas.ts`, persistence in the goal/profile
    model, and localized EN/FR/AR form copy.
  - **Done when:** onboarding remains completable in under five minutes and each new
    field is visible in the data contract and context tests.
- [ ] Add progressive profile-gap prompts instead of asking every question at signup.
  Ask one relevant question when the missing value would change the current advice;
  do not repeatedly ask for data the runner declined.
  - **Done when:** a beginner with no route/equipment information still receives a
    safe answer, but gets one clear optional question when personalization is limited.
- [ ] Normalize historical race results and ZidRun registrations when available:
  distance, finish time, pace, date, course type, and result status. Keep the free-text
  `recentRaceResult` as a fallback, not the only history source.
  - **Done when:** race-target advice can compare the goal with the runner's actual
    prior result without treating an unverified note as a measured result.
- [ ] Improve sleep and nutrition signals only where they change coaching decisions:
  sleep consistency/quality and recovery trend; long-run fueling timing, hydration
  behavior, GI tolerance, and dietary constraints. Do not infer medical or dietary
  diagnoses from sparse logs.
  - **Done when:** the context distinguishes “no data” from “poor data” and the coach
    does not make strong claims from one logged meal or one short night.

### Phase 4 — location and local realism (P1)

- [ ] Add a privacy-safe training-location preference: timezone, optional usual area,
  preferred workout time, terrain/surface, and a consented approximate coordinate or
  wilaya fallback. Keep raw GPS routes for run analysis only; never send raw route
  coordinates to OpenAI.
  - **Done when:** local advice uses “near your area” for approximate weather and the
    runner can disable location-based personalization without losing the coach.
- [ ] Add cached weather enrichment keyed by coarse area + date/time window. Include
  `source`, `approximate`, `observedAt`, and forecast confidence/availability in the
  context.
  - **Done when:** repeated chat requests do not make redundant weather calls, a
    provider outage does not block coaching, and the model is told when data is stale.
- [ ] Add travel-to-race handling: compare home area with target-race area, ask whether
  the runner will travel, and give timezone/acclimatization advice only when the data
  is known. Do not infer travel plans from a race registration alone.
  - **Done when:** local training advice and race-location advice are clearly separated.

### Phase 5 — quality, evaluation, and operations (P1)

- [ ] Refactor context assembly into a typed `assembleCoachContext()` result with
  `contextVersion`, `assembledAt`, per-section freshness, omitted-field reasons, and a
  stable context hash. Keep `buildRunnerCoachContext()` as a pure serializer.
  - **Done when:** unit tests can assert the exact payload without calling OpenAI and
    logs can identify which context version produced an answer.
- [ ] Add an interaction context audit trail. Store the hash and minimal metadata by
  default; store a redacted context snapshot only under the documented retention and
  access policy. Never log the raw prompt, health notes, GPS, or user free text.
  - **Done when:** support/admin can reproduce the shape and source versions of a
    response without exposing sensitive content in normal logs.
- [ ] Expand the structured response schema with `usedSignals`, `dataGaps`,
  `assumptions`, and at most one `followUpQuestion`. Keep workout fields nullable and
  let the coach say “I need more information” when appropriate.
  - **Done when:** evaluations show fewer generic answers and no fabricated weather,
    race, injury, or performance facts.
- [ ] Add deterministic fixture/evaluation cases for: new beginner, experienced
  runner, inconsistent runner, missed plan workout, target road race, target trail
  race, hot wilaya, GPS run with weather, no-location runner, injury signal, sparse
  sleep/nutrition, long conversation, prompt injection, and EN/FR/AR output.
  - **Done when:** `npm run test:coach` covers context assembly, privacy exclusions,
    safety invariants, plan adherence, conversation memory, and localization.
- [ ] Add product metrics that do not collect message content: context completeness,
  profile-gap completion, answer helpfulness, plan acceptance, workout adherence,
  safety blocks, provider failures, and cost per active runner.
  - **Done when:** metrics are documented, privacy-reviewed, and visible to admins
    without exposing runner health or conversation text.
- [ ] Run a closed beta review with a qualified running coach/sports-health professional
  and real runners before enabling expanded health/location personalization.
  - **Done when:** safety rules, escalation copy, data collection, and representative
    outputs have written approval or explicit follow-up decisions.

## Recommended delivery slices

1. **Slice A:** data contract, prompt-injection tests, actual-plan/adherence context,
   typed context version/hash, and context unit fixtures.
2. **Slice B:** confirmed `CoachMemory`, memory controls, acceptance/outcome tracking,
   and recent-turn improvements.
3. **Slice C:** timezone/coarse location/weather freshness and normalized target-race
   context.
4. **Slice D:** progressive profile fields, sleep/nutrition depth, response data-gap
   fields, beta evaluation, and privacy/export/deletion completion.

Do not start vector search, fine-tuning, or an indefinitely growing provider-side thread
until these slices demonstrate that structured ZidRun data and confirmed user memory are
insufficient.
