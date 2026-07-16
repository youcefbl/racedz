# ZidRun Coach — Execution Plan

> **Plan revisions (2026-07-16 review).** Verified the "current implementation" claims against the
> code — all accurate (56-day window, 6-turn conversation memory, and the AI's `upcomingWorkouts`
> being discarded and replaced by the deterministic skeleton in `enforceCoachSafety`). Changes from
> the review: timezone made a documented Algeria-UTC+1 assumption so Phase 1.2 can ship now instead
> of waiting on Phase 4; run-to-workout matching biased toward "ask" with explicit thresholds;
> per-phase context/cost budgets added; a free-runner (no accepted plan) track added; a deterministic
> definition of a "significant" plan change added; owner-ops and the health-data policy reconciled
> with [EXECUTION_PLAN.md](EXECUTION_PLAN.md) (health-data policy promoted to a Phase 0 blocker); and
> the user-locale sync item marked done (shipped with notification i18n). No data backfill/cutover is
> planned because production has no real runner accounts yet.

## Objective

Make the AI Coach ZidRun's main runner feature: a highly personalized, adaptive coaching loop that connects a runner's goal, training plan, workouts, run history, missed sessions, recovery signals, location, race context, and conversations.

The core loop should be:

> Goal → personalized plan → guided workout → run record → adherence analysis → adaptive next session → reminder/check-in

Coach should be a continuous training product, not only a chat interface with a weekly plan attached.

## Security action before development

The OpenAI API key was exposed in the local `.env` editor context. Rotate it immediately in the OpenAI project, replace the local value, and verify that `.env` remains ignored by Git. Never place the key in this document, client code, browser bundles, logs, or any `NEXT_PUBLIC_` variable.

The repository documentation also reports that the configured project currently returns `insufficient_quota`; enable billing/quota before running paid live-provider tests.

## Current implementation assessment

### What already works

The coach already has a strong MVP foundation:

- Persisted goals, runs, plans, workouts, snapshots, interactions, and AI usage logs.
- Goal onboarding with race type, target date, distance, target time, experience, weekly volume, training days, health information, and language.
- Manual, GPS, and GPX-imported run logging.
- Pace, weekly volume, consistency, fatigue, pain, and intensity calculations.
- Post-run analysis with weather, GPS route, and per-kilometre splits when available.
- Sleep and nutrition context.
- Wilaya/city and linked target-race context.
- English, French, and Arabic responses with safety checks.
- Structured OpenAI responses with Zod validation.
- Deterministic safety limits and provider-failure persistence.
- Daily plan reminders, inactivity nudges, and weekly plan rollover jobs.
- Mobile guided workouts and a runner dashboard.

Relevant implementation areas:

- [Coach context builder](src/lib/coach/context.ts)
- [Coach orchestration service](src/lib/coach/service.ts)
- [Planning skeleton](src/lib/coach/planning.ts)
- [Safety enforcement](src/lib/coach/safety.ts)
- [OpenAI adapter](src/lib/coach/openai.ts)
- [Coach dashboard](src/components/coach/coach-dashboard.tsx)

### Current limitations

The current system is a personalized explanation layer over a relatively simple deterministic plan.

1. The model receives only the last six conversations, condensed to the runner's question and a short response summary. Full stored responses are not used as long-term conversational memory.
2. Runs older than approximately 56 days are excluded from coach calculations and context.
3. Previous goals, race registrations, race results, and personal records are not meaningfully included in coaching context.
4. Location is limited mainly to Wilaya/city; commune, timezone, preferred run time, terrain, and usual routes are not used.
5. A workout is marked complete only when a run is explicitly linked to its `workoutId`.
6. Free runs and imported runs are usually not matched to planned workouts.
7. Missed workouts are visually inferred in the UI but are not persisted as `SKIPPED`.
8. The coach does not receive the actual active plan with workout completion statuses. It receives a newly generated fixed weekly skeleton.
9. The deterministic plan mainly uses experience, recent distance, available days, and long-run day.
10. Target race distance, target time, race date, race elevation, sleep, nutrition, injury history, and weather do not materially shape the generated workout schedule.
11. The AI's generated upcoming workouts are replaced by the deterministic skeleton before saving, so AI personalization mostly affects explanations rather than the plan itself.
12. Weekly rollover depends on an externally scheduled cron job. Production must verify that the cron jobs are configured and monitored.

## Product principles

- **Adherence before intelligence:** The coach must know what was planned, what happened, and why before it can adapt intelligently.
- **AI explains and personalizes; deterministic rules protect:** The model may propose and explain, but application rules own dates, load, recovery, safety, and data integrity.
- **Never punish missed runs:** Missing a workout should trigger a supportive adjustment, not an automatic catch-up block.
- **One clear next action:** Every coach visit should answer, “What should I do today?”
- **Runner-controlled data:** Health, GPS, precise location, sleep, and nutrition inputs must be optional, clearly explained, exportable, and deletable.
- **Goal-specific context:** Historical data should be separated into useful global fitness history and goal-specific training history.
- **Local relevance:** Advice should account for Algeria's climate, Wilaya, terrain, schedule, and target race environment when the runner permits it.
- **Measurable quality:** Every major coaching change should be testable against deterministic fixtures and reviewed for safety.

## Execution roadmap

## Phase 0 — Stabilize and measure

### Deliverables

- Rotate the exposed OpenAI credential. *(Owner op — tracked in [EXECUTION_PLAN.md](EXECUTION_PLAN.md);
  don't duplicate the checklist, just confirm done before development.)*
- Confirm `.env` is ignored and secrets are absent from Git history and logs.
- Confirm OpenAI project billing/quota. *(Owner op — same tracking; the project currently returns
  `insufficient_quota`, so paid live-provider tests are blocked until this clears.)*
- **Health-data privacy/consent/retention policy line — BLOCKER.** Phase 3 (storing injury/recovery
  status, expiring stale health data) and Phase 4 (opt-in precise location) cannot legally ship without
  it, and EXECUTION_PLAN.md's coach-onboarding item already flags this as a prerequisite. Write the
  policy line (what health data is stored, consent model, retention/expiry, deletion) before any phase
  that persists health or precise-location data.
- Verify the two coach cron endpoints are scheduled:
  - `/api/internal/cron/plan-rollover`
  - `/api/internal/cron/training-reminder`
- Add structured coach analytics without storing sensitive message content.
- Add baseline metrics for the current system. *(Note: production has no real runner accounts yet, so
  the first baseline is effectively the beta cohort — treat these as the metrics to instrument, not
  historical numbers to read today.)*

### Baseline metrics

- Goal creation completion rate.
- Percentage of runners who generate and accept a plan.
- Runs logged per coached runner per week.
- Percentage of runs linked to a workout.
- Percentage of planned workouts completed.
- Number of workouts visually missed but still stored as `PLANNED`.
- AI request success/failure rate and cost.
- Weekly active coached runners.
- Seven-day and thirty-day retention.

### Exit criteria

- Secret rotation completed.
- Cron execution is visible in logs/monitoring.
- Baseline dashboard can distinguish plan usage, run logging, and AI chat usage.

## Phase 1 — Implement real plan adherence

This is the highest-priority engineering phase.

### 1.1 Persist workout outcomes

Use the existing workout status values and add outcome information where needed.

Recommended fields on `TrainingWorkout`:

- `completedAt`
- `skippedAt`
- `skipReason`
- `rescheduledFor`
- `completionType`: `AS_PLANNED`, `PARTIAL`, `EASIER_THAN_PLANNED`, `HARDER_THAN_PLANNED`
- `completionConfidence`
- `runnerNote`

Recommended skip reasons:

- `SCHEDULE`
- `FATIGUE`
- `PAIN_OR_SYMPTOMS`
- `WEATHER`
- `ILLNESS`
- `TRAVEL`
- `MOTIVATION`
- `OTHER`

If a separate event model is preferred, add `WorkoutOutcome` rather than overloading `TrainingWorkout`. Keep the workout's final status authoritative.

### 1.2 Automatically close missed sessions

At the end of each runner's local training day:

- `PLANNED` workout with no matching run → `SKIPPED`.
- Do not mark `REST` or intentionally cancelled workouts as missed.
- Store the local date and timezone used for the decision.
- Prompt the runner for a reason on their next visit when possible.

The rollover process must close the previous plan's workouts before creating the next plan.

**Timezone assumption (unblocks this phase).** "End of the runner's local day" needs a timezone, but
per-runner timezone capture isn't introduced until Phase 4 — so, taken literally, 1.2 would be blocked
on a Phase 4 field. Resolve it with a documented interim assumption: **Algeria is a single timezone,
UTC+1 (Africa/Algiers), with no DST**, so close missed sessions against UTC+1 now and store that as the
timezone used. Replace the constant with the per-runner timezone only when Coach expands beyond Algeria
(Phase 4). This keeps the stored "timezone used for the decision" honest today and forward-compatible
later.

*(No historical backfill: production has no real runner accounts yet, so there are no legacy `PLANNED`
rows to retroactively close. When real accounts exist, revisit whether a cutover date is needed before
enabling auto-close.)*

### 1.3 Match unlinked runs to planned workouts

When a manual, GPS, or imported run is saved without a workout ID:

1. Search workouts near the run's local date.
2. Compare distance, duration, type, intensity, and start time.
3. Calculate a confidence score.
4. Auto-link high-confidence matches.
5. Ask the runner to confirm medium-confidence matches.
6. Keep low-confidence runs as free runs.

Do not allow a client to attach a run to an arbitrary future or unrelated workout without server-side date and ownership validation.

**This is the riskiest deterministic component — bias toward "ask."** A false auto-link corrupts the
adherence metrics (1.4), which then corrupt the Phase 2 adaptation, so matching errors *compound
downstream*. Being uncertain (ask the runner) is cheaper than being wrong (silent bad link). Concretely:

- Only auto-link (step 4) when the run is on the **same local day** as the workout **and** distance is
  within ~15% **and** the type is compatible — a narrow, high-precision band. When unsure, drop to
  "ask," never to auto-link.
- Ask-to-confirm (step 5) covers same/adjacent-day near-misses; everything else stays a free run.
- Persist the match provenance (`AUTO`, `RUNNER_CONFIRMED`, `RUNNER_MANUAL`) and the confidence score
  alongside the link, so a later audit can find and unwind bad auto-links.
- Start the thresholds deliberately conservative and loosen them only once the confirm-rate data shows
  auto-links are being accepted. Log the precision/recall of auto-links as a Phase 0 metric.

### 1.4 Add adherence metrics

Create deterministic metrics for:

- Planned sessions.
- Completed sessions.
- Skipped sessions.
- Completion percentage.
- Planned versus completed distance.
- Planned versus completed duration.
- Easy/hard intensity adherence.
- Long-run completion.
- Number of consecutive missed sessions.
- Recovery debt after missed or hard sessions.

Expose these metrics in the dashboard and coach context.

### 1.5 Update the runner experience

Add clear actions to every workout:

- `Start workout`.
- `Log completed run`.
- `I cannot do this today`.
- `Move workout`.
- `Mark as free run`.

After a missed workout, show supportive language and the next safe action. Do not shame the runner or suggest automatically making up every missed kilometre.

### 1.6 Serve the free-runner (no accepted plan)

The rest of this plan is plan-centric, but the baseline metrics (Phase 0) expect a low "% who accept a
plan" and a large share of free/imported runs. If most runners never accept a plan, adherence tracking
runs against a tiny denominator and "Coach as the main surface" underdelivers for the majority.

Define what the coach gives the runner who **logs runs but has not committed to a plan**:

- A useful read on their *actual* training from run history alone — volume trend, consistency, pace
  drift, fatigue/pain signals — without requiring a plan.
- A low-friction, non-nagging path to accept a plan when they're ready, framed by what their own runs
  already show.
- Chat and post-run analysis that stand on their own for this runner.

Adherence metrics should degrade gracefully (clearly "no active plan") rather than read as 0% adherence,
which would be both wrong and discouraging.

### Phase 1 exit criteria

- A run can be accurately linked, partially linked, or left free.
- Planned workouts become completed or skipped deterministically.
- The coach can state actual plan adherence with numbers.
- Missed runs produce a stored reason or a clear “reason unknown” state.
- Tests cover one missed run, multiple missed runs, free runs, imported runs, and rescheduling.

## Phase 2 — Build an adaptive deterministic planning engine

Replace the current weekly skeleton with a planner that creates safe candidate sessions from the runner's full current state.

### Planner inputs

- Active goal and previous goal history.
- Target race, distance, target time, date, terrain, and elevation.
- Current, recent, and peak weekly volume.
- Longest recent run and recent race performance.
- Actual plan adherence.
- Pace, heart rate, effort, fatigue, and pain trends.
- Sleep and nutrition trends.
- Available days and preferred long-run day.
- Preferred training time and timezone.
- Wilaya, weather, terrain, and indoor alternatives.
- Runner constraints, injury history, and chronic conditions.

### Plan phases

Support goal-relative training phases:

1. Baseline and onboarding.
2. Base building.
3. Development/build.
4. Race-specific preparation.
5. Peak.
6. Taper.
7. Recovery and post-race transition.

The schedule must use the target date and not merely stop generating plans after the date passes.

### Missed-run adaptation rules

- One missed easy run: continue normally or move it if recovery is good.
- One missed hard workout: do not stack it beside another hard workout.
- Missed long run: shorten or replace it; do not immediately add all lost distance.
- Two or more missed sessions: reduce the following week and reassess.
- Ten or more days away: return with easy running and rebuild progressively.
- High pain, severe fatigue, or danger signals: pause normal progression and use the safety flow.

### AI responsibility

The model should:

- Explain why the plan fits the runner.
- Personalize workout names and instructions.
- Offer practical alternatives.
- Explain missed-run adjustments.
- Answer runner questions in the preferred language.

The application should remain responsible for:

- Workout dates.
- Rest-day minimums.
- Distance and duration ceilings.
- Load progression.
- Taper boundaries.
- Workout type limits.
- Safety blocks and caution reductions.

### Plan versioning

Each accepted plan should record:

- Input snapshot or snapshot ID.
- Planner version.
- Prompt version, if AI was involved.
- Reason for generation.
- Changes from the previous plan.
- Runner acceptance timestamp.

**Define "significant" deterministically.** Phase 2 exit criteria say plan changes "require runner
acceptance when significant" — but an undefined threshold means either acceptance-fatigue (re-confirm
everything) or silent changes the runner never notices. Pick concrete triggers, e.g. re-acceptance is
required when the change crosses any of: weekly planned load Δ > ~15%, a hard-workout added/removed/swapped,
a long-run distance change beyond a set band, or a taper-boundary shift. Everything below the threshold
updates silently but is still recorded in the change summary. Tune the numbers with the sports-health
review (below).

### Phase 2 exit criteria

- A 5K, 10K, half-marathon, marathon, general fitness, and trail goal produce meaningfully different plans.
- Target date changes the phase and workout mix.
- Missed sessions affect the next plan.
- Sleep, fatigue, pain, and adherence can reduce or change upcoming workload.
- Plan changes are visible and require runner acceptance when significant.

## Phase 3 — Build useful long-term coaching memory

Do not send an indefinitely growing chat transcript. Store structured memory and retrieve relevant history.

### Structured memory model

Add a compact memory record containing:

- Stable runner preferences.
- Preferred coaching tone.
- Typical schedule and training time.
- Terrain and route preferences.
- Repeated constraints.
- Injury/recovery status, with dates and user control.
- Important runner commitments.
- Recent successful strategies.
- Recent failed strategies.
- Current adherence summary.
- Current training phase.
- Last meaningful coach recommendations.
- Runner feedback on recommendations.

### Conversation handling

- Keep full interactions in PostgreSQL.
- Add paginated conversation history for the runner.
- Send recent exchanges plus relevant older exchanges.
- Store structured “coach facts” instead of relying only on text summaries.
- Include accepted plan changes, missed-run reasons, and previous follow-up commitments.
- Include human coach notes in the same memory pipeline.
- Never send unnecessary PII, authentication data, national IDs, or exact addresses.

### Memory quality rules

- Attach every memory item to a source and timestamp.
- Allow runners to inspect, correct, export, and delete memory.
- Expire stale health and injury information unless reconfirmed.
- Distinguish runner-provided facts from AI inferences.
- Never treat an AI-generated assumption as a runner fact.

### Phase 3 exit criteria

- The coach can remember a runner's prior relevant preference after more than six interactions.
- The coach does not repeat advice that the runner already rejected.
- Old goals do not contaminate current-goal adherence calculations.
- Memory can be deleted and exported.

## Phase 4 — Expand location and runner personalization

### Optional runner inputs

- Commune.
- Training coordinates or preferred area.
- Timezone and preferred run times.
- Road, trail, track, treadmill, or mixed surface.
- Typical elevation.
- Indoor-training availability.
- Heat/rain/wind preferences.
- Travel schedule.
- Race-day transportation constraints.

### Location-driven coaching

- Recommend cooler training times in hot weather.
- Adjust effort expectations for humidity, wind, and elevation.
- Suggest terrain-specific workouts.
- Prepare the runner for the target race's course.
- Offer indoor or alternative sessions during unsafe weather.
- Use local time for reminders and missed-workout closure.

Precise location must be opt-in. Wilaya-level fallback remains available when the runner does not share a route or exact location.

## Phase 5 — Make Coach the main product surface

### Coach home

The first screen should show:

1. Today's recommended action.
2. Why it matters for the runner's goal.
3. Start guided workout.
4. Quick check-in for sleep, fatigue, pain, and available time.
5. Current plan adherence.
6. Progress toward the goal.
7. The next adjustment.

### Adaptive check-ins

Use in-app, push, and email notifications carefully:

- Before a hard workout.
- After a missed workout.
- After a completed workout.
- During weekly review.
- Before taper.
- Before race day.
- After a long period of inactivity.

Notification content should reflect the actual workout and runner state, not generic reminders.

### Conversation role

Keep chat as a powerful support surface for:

- “Why this workout?”
- “I only have 30 minutes.”
- “I missed Tuesday.”
- “My knee hurts.”
- “The weather is too hot.”
- “How should I pace race day?”

The chat should be able to trigger structured actions, such as moving a workout or starting a recovery week, but only after explicit runner confirmation and server-side validation.

## Cost and context budget

Phases 2–3 add planner inputs and long-term memory retrieval, which means more tokens per call — on a
project where the OpenAI key currently returns `insufficient_quota` and cost is an explicit concern.
Growing context without a ceiling is a latency and cost regression waiting to happen.

- Set a **per-phase token/context budget** and treat it as a constraint, not an afterthought.
- Build on the existing context trimmer (`compactIfNeeded` in `src/lib/coach/context.ts`) rather than
  bypassing it — retrieval (Phase 3) should select the *most relevant* memory within the budget, not
  append everything.
- Track cost-per-coached-interaction as a Phase 0 metric so each phase's context growth is visible
  against real spend, and wire the cost alerts required by the release gates early.

## Data and schema work

Likely schema changes:

- Workout completion metadata and skip reasons.
- Workout rescheduling or outcome table.
- Workout-to-run match confidence and matching source.
- Local timezone and preferred training time.
- Optional runner terrain and training preferences.
- Coach memory records.
- Plan input snapshots and change summaries.
- Coach action/commitment records.
- ~~User locale synchronization, eventually shared with non-coach notifications.~~ **✅ Done** —
  `User.language` exists and is threaded into recipient-facing notifications (shipped with the
  notification-i18n work in EXECUTION_PLAN.md). No further schema work needed here.

All changes must use Prisma migrations and preserve the existing raw-SQL compatibility notes until Prisma client generation is reliable.

## Testing strategy

### Deterministic unit tests

Add fixtures for:

- Beginner 5K runner.
- Experienced 10K runner.
- Half-marathon runner with a target time.
- Trail runner with elevation.
- Runner in a hot Wilaya.
- Runner with insufficient sleep.
- Runner with high fatigue.
- Runner with pain or danger signals.
- One missed session.
- Several missed sessions.
- Ten-day return after a break.
- Free run not matching a planned workout.
- Imported run matching a workout.
- Run from a previous goal.
- Rescheduled workout.
- English, French, and Arabic output.

### Authorization tests

Verify that a runner cannot:

- Read another runner's plans, workouts, runs, interactions, or memory.
- Attach a run to another runner's workout.
- Modify another runner's workout status.
- Export or delete another runner's coach data.

### Prompt and output evaluations

Evaluate:

- Whether the response uses actual runner numbers.
- Whether it refers to the correct target race.
- Whether it accounts for missed sessions.
- Whether it avoids generic repetition.
- Whether it obeys the selected language.
- Whether it avoids unsafe catch-up advice.
- Whether it handles weather and location only when data exists.
- Whether it clearly distinguishes facts from assumptions.

### End-to-end journeys

Cover:

1. Create goal.
2. Generate and accept plan.
3. Start guided workout.
4. Log completed workout.
5. Miss a workout and provide a reason.
6. Receive an adapted next workout.
7. Ask a context-aware chat question.
8. Return after a break.
9. Change goal.
10. Export and delete coach data.

## Release plan

### Closed beta

Start with 50–100 runners after:

- Safety review by a qualified running coach or sports-health professional. **Scope it to the Phase 2
  deterministic rule tables** (load ceilings, rest-day minimums, taper boundaries, missed-run
  adaptation, the "significant change" thresholds) — not only the prompt output. That's where the real
  safety risk lives, and it's the same external review already tracked as an owner op in
  [EXECUTION_PLAN.md](EXECUTION_PLAN.md).
- Deterministic adherence tests.
- Prompt evaluation results.
- Working data export/deletion.
- Production cron monitoring.
- OpenAI quota and cost alerts.

### Beta feedback questions

- Did the coach understand your goal?
- Did the plan fit your available days?
- Did it notice when you missed a workout?
- Did the next workout feel appropriate after fatigue or poor sleep?
- Did the coach remember your previous conversations?
- Did advice feel specific to your Wilaya, routes, and race?
- Did you know exactly what to do today?

### Public-release gates

- No known critical authorization issues.
- No unsafe workout escalation in evaluation fixtures.
- Accurate completion and missed-workout tracking.
- Data deletion/export verified.
- Cron jobs monitored and idempotent.
- Cost limits and failure reporting active.
- English, French, Arabic, RTL, dark, light, race theme, and mobile QA complete.

## Recommended implementation order

1. Rotate the exposed credential and verify production secret handling.
2. Implement workout status closure, skip reasons, and run-to-workout matching.
3. Add real adherence metrics to the dashboard and coach context.
4. Replace the weekly skeleton with a goal-relative adaptive planner.
5. Add missed-run recovery and rescheduling flows.
6. Add structured long-term memory and paginated conversation history.
7. Add richer location, schedule, terrain, and race personalization.
8. Rebuild the Coach home as the runner's primary daily surface.
9. Add evaluations, authorization tests, export/deletion, monitoring, and closed beta.

## Definition of success

The coach is ready to become ZidRun's main feature when it can reliably answer, for every coached runner:

- What is this runner training for?
- What should they do today?
- What did they actually do recently?
- Which planned sessions were completed, skipped, or modified?
- Why were sessions missed?
- Is the runner recovering well enough for the next session?
- How should the plan change safely?
- What has the runner previously told the coach that still matters?
- How do location, weather, terrain, race conditions, and schedule affect the advice?

The first milestone is not a smarter chat response. It is accurate adherence tracking and safe adaptation based on what actually happened.
