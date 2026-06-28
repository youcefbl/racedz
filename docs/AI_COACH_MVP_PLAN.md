# ZidRun AI Coach MVP Plan

## Purpose

Add a runner-focused AI coach that uses saved goals, training plans, and run history to provide:

- Post-run feedback.
- A structured next-run recommendation.
- A weekly training plan.
- Progress summaries against a runner's goal.
- A coach conversation grounded in the runner's ZidRun data.

The first version is a training assistant, not a medical service. It must not diagnose injuries, replace a qualified coach, or make unrestricted changes to training load.

## Implementation Status

Backend and runner workflow implemented on June 21, 2026:

- Prisma models and migration for goals, runs, versioned plans/workouts, snapshots, interactions, and AI usage logs.
- Deterministic pace, training-volume, trend, and weekly plan-skeleton calculations.
- English, French, and Arabic danger-signal checks plus caution and blocking behavior.
- Safety enforcement that prevents AI output from changing fixed workout dates, types, or distance limits.
- Server-only OpenAI Responses API integration using `gpt-5.4-mini`, Structured Outputs, Zod parsing, usage tracking, and graceful provider failure.
- Per-user daily and monthly AI request limits.
- Authenticated APIs:
  - `GET /api/coach`
  - `GET|POST /api/coach/goals`
  - `PATCH /api/coach/goals/[id]`
  - `GET|POST /api/coach/runs`
  - `POST /api/coach/interactions`
  - `PATCH /api/coach/plans/[id]`
- Focused deterministic checks available through `npm run test:coach`.
- Mobile-first `/account/coach` UI for goal onboarding, progress, run logging/history, weekly plan review/acceptance, post-run feedback, and conversation.
- English, French, and Arabic UI copy with RTL layout and light/dark/race theme compatibility.
- Authenticated Playwright coverage through `npm run test:e2e:coach`, plus an opt-in paid provider assertion with `RACEDZ_REQUIRE_LIVE_AI=1`.

The configured OpenAI project currently returns `insufficient_quota`; enable project billing/quota before the live plan/feedback assertion can pass. Expert safety review, broader authorization/evaluation coverage, data export/deletion, full theme/RTL visual QA, and closed beta remain open.

## MVP Scope

### Include

- Coach onboarding:
  - Goal type, such as general fitness, 5K, 10K, half marathon, marathon, or trail event.
  - Target date and optional target race.
  - Current weekly distance and recent best performance.
  - Running experience.
  - Available training days.
  - Preferred long-run day.
  - Constraints, injury notes, and preferred language.
- Manual run logging:
  - Date.
  - Distance.
  - Duration.
  - Average pace calculated by ZidRun.
  - Optional elevation gain and average heart rate.
  - Perceived effort from 1 to 10.
  - Fatigue or pain indicators.
  - Runner notes.
- Coach dashboard:
  - Current goal.
  - This week's plan and completion.
  - Next workout.
  - Weekly distance and recent trend.
  - Recent feedback.
- Post-run analysis and safe adjustment of upcoming workouts.
- Weekly plan generation and review.
- Coach conversation using compact, saved runner context.
- English, French, and Arabic output.
- AI token and cost tracking per request and per user.

### Exclude From The First MVP

- Live GPS run recording.
- Live voice coaching.
- Automatic Apple Health, Health Connect, Garmin, or Strava synchronization.
- Medical diagnosis or rehabilitation plans.
- Fully autonomous plan changes without runner visibility.
- Fine-tuning, vector databases, or retrieval infrastructure.

These can be evaluated after manual run logging proves that runners use the coaching workflow.

## Product Workflow

### Initial Setup

1. The runner creates one active goal.
2. ZidRun validates that the goal and target date are usable.
3. ZidRun creates a conservative initial plan skeleton using deterministic application rules.
4. The AI personalizes and explains that plan in the runner's language.
5. The runner reviews and accepts the plan.

### After A Run

1. Save the run to PostgreSQL before calling OpenAI.
2. Calculate deterministic metrics in ZidRun:
   - Average pace.
   - Weekly distance.
   - Plan adherence.
   - Distance and pace trends.
   - Recent training frequency.
   - Fatigue and pain flags.
3. Update a compact coach snapshot.
4. Call OpenAI only when post-run feedback is requested or configured.
5. Validate the structured AI response with Zod.
6. Apply ZidRun safety rules before displaying or saving plan adjustments.
7. Store the feedback, usage, model, and accepted plan changes.

### Weekly Review

1. Aggregate the previous four to eight weeks of training.
2. Compare completed workouts with the active goal and plan.
3. Generate the next week of workouts.
4. Notify the runner that the plan is ready.

## Architecture

ZidRun PostgreSQL is the source of truth for coaching memory. Do not use one indefinitely growing OpenAI conversation as the runner's permanent context.

For each request, build a compact `RunnerCoachContext` containing only:

- Pseudonymous runner ID.
- Goal and target date.
- Experience and training availability.
- Current plan and completion state.
- Last five to ten runs.
- Four-to-eight-week aggregate metrics.
- Relevant constraints, fatigue, and pain flags.
- Preferred response language.

Do not send email addresses, phone numbers, national IDs, exact addresses, authentication data, or unrelated profile information.

### Suggested Service Boundaries

- `src/lib/coach/metrics.ts`: deterministic pace, volume, trend, and adherence calculations.
- `src/lib/coach/context.ts`: compact prompt context builder.
- `src/lib/coach/safety.ts`: non-AI safety and workload constraints.
- `src/lib/coach/openai.ts`: server-only OpenAI Responses API adapter.
- `src/lib/coach/schemas.ts`: Zod input and structured-output schemas.
- `src/lib/coach/service.ts`: orchestration, persistence, rate limits, and error handling.

The OpenAI API key must only be available to server-side code. The browser must call an authenticated ZidRun route handler or server action.

## Proposed Data Model

### `RunnerGoal`

- `id`, `userId`
- `goalType`, `targetDate`, optional `raceEventId`
- Optional target distance and target time
- Experience level and current weekly distance
- Available training days and preferred long-run day
- Constraints and injury notes
- `status`: active, completed, paused, cancelled
- `createdAt`, `updatedAt`

Only one active goal should be allowed per runner in the MVP.

### `RunnerRun`

- `id`, `userId`, optional `goalId`, optional `workoutId`
- `startedAt`, `distanceKm`, `durationSeconds`, calculated `averagePaceSecondsPerKm`
- Optional `elevationGainM`, `averageHeartRate`
- `perceivedEffort`, fatigue flag, pain flag, notes
- `source`: manual initially, integration later
- `createdAt`, `updatedAt`

### `TrainingPlan` And `TrainingWorkout`

- Plan ownership, date range, version, status, and generation source.
- Workout date, type, target distance/duration, intensity, instructions, and completion status.
- Store plan versions so accepted AI adjustments remain auditable.

### `CoachInteraction`

- `userId`, optional `goalId` and `runId`
- Interaction type: initial plan, post-run, weekly review, or chat
- Validated structured response
- Safety outcome and whether the runner accepted adjustments
- Model and timestamps

### `CoachSnapshot`

- Compact derived metrics used to build AI context.
- Recomputed after run changes rather than storing raw prompt history as memory.

### `AiUsageLog`

- User, feature, model, request identifier
- Input, cached-input, reasoning, and output token counts when available
- Estimated cost and request status
- Created timestamp

## OpenAI Integration

Use the OpenAI Responses API with Structured Outputs. Start with `gpt-5.4-mini` for plan generation and post-run feedback because it supports structured outputs and is intended for lower-cost, high-volume workloads.

The response schema should include:

- `summary`
- `progressAssessment`
- `positiveSignals[]`
- `warningSignals[]`
- `nextWorkout`
- `upcomingWorkoutAdjustments[]`
- `recoveryAdvice[]`
- `requiresProfessionalAdvice`

Keep factual calculations outside the model. The model should explain and personalize metrics calculated by ZidRun, not invent those metrics.

Do not add fine-tuning initially. Use a versioned system prompt, structured context, deterministic safeguards, and a repeatable evaluation dataset first.

References:

- [GPT-5.4 mini model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [OpenAI API pricing](https://openai.com/api/pricing/)

## Safety And Privacy

- Present the feature as training guidance, not medical advice.
- Do not diagnose conditions or recommend medication.
- Suppress normal coaching advice and recommend appropriate professional help when a runner reports severe pain, chest pain, fainting, breathing difficulty, or another configured danger signal.
- Use deterministic limits for training frequency, workload increases, recovery, and rest days.
- Require explicit runner confirmation before significant plan changes.
- Provide a clear way to pause the plan and AI coaching.
- Allow runners to export and delete coaching data.
- Document retention before production.
- Apply server-side authorization to every goal, run, plan, and interaction operation.
- Apply per-user rate limits and monthly usage limits.
- Never expose the OpenAI API key to the client.
- Log enough metadata to investigate unsafe or malformed output without logging unnecessary personal data.

Before public release, have the initial coaching templates and safety rules reviewed by a qualified running coach or sports-health professional.

## Cost Estimate

Pricing checked on June 20, 2026. `gpt-5.4-mini` pricing is $0.75 per million input tokens, $0.075 per million cached input tokens, and $4.50 per million output tokens. Prices can change; verify the official pricing page before production budgeting.

Example optimized interaction:

- 3,000 input tokens.
- 700 output tokens.
- Estimated model cost: approximately $0.0054 per response.
- At 12 responses per active coached runner per month: approximately $0.065 per runner per month.

| Active coached runners | Base monthly estimate | Estimate with 20% buffer |
| ---: | ---: | ---: |
| 100 | $6.50 | $8 |
| 1,000 | $65 | $80 |
| 10,000 | $648 | $780 |

These estimates exclude hosting, taxes, retries, unusually long conversations, and future voice or integration costs. They assume compact context. Sending every historical run and message on every request will increase cost and reduce context quality.

Cost controls:

- Generate deterministic metrics without AI.
- Call AI on demand and for one weekly review, not for every page view.
- Keep recent raw runs plus aggregate history in the prompt.
- Limit response length.
- Reuse a stable prompt prefix so cached input can help when available.
- Track actual tokens and estimated cost per interaction.
- Configure per-user daily limits and a platform monthly budget alert.
- Use asynchronous batch processing only for non-urgent aggregate jobs when it provides a meaningful saving.

## Delivery Plan

### Phase 1: Foundation - 4 To 6 Days

- Confirm product and safety rules.
- Add Prisma models and migrations.
- Add goal onboarding and manual run CRUD.
- Add deterministic pace and weekly-volume calculations.

### Phase 2: Planning Engine - 4 To 7 Days

- Add plan and workout versioning.
- Implement conservative workload and recovery constraints.
- Add plan adherence and progress calculations.

### Phase 3: OpenAI Integration - 4 To 6 Days

- Add the server-only OpenAI adapter.
- Add structured response schemas and validation.
- Add coach snapshots, interaction storage, usage logs, and rate limits.
- Handle timeout, provider failure, invalid output, and retry behavior without losing run data.

### Phase 4: Runner UI - 7 To 12 Days

- Build mobile-first coach onboarding.
- Build run logging and run history.
- Build the coach dashboard, weekly plan, post-run feedback, and conversation UI.
- Cover light, dark, and race themes plus English, French, and Arabic layouts.

### Phase 5: Evaluation And Beta - 5 To 8 Days

- Create deterministic fixtures and automated tests for metrics and authorization.
- Build an evaluation dataset covering beginner, experienced, inconsistent, fatigued, and pain-reporting runners.
- Test prompt and output-schema regressions.
- Run a closed beta with 50 to 100 runners.
- Compare generated plans with reviewed templates and collect explicit feedback.

Estimated total for one experienced developer: four to seven weeks for the web MVP. GPS tracking, wearable integrations, and live voice coaching should be estimated separately after the beta.

## Acceptance Criteria

- A runner can create, pause, and complete one active goal.
- A runner can manually record and edit a run.
- Pace and progress metrics are calculated deterministically and tested.
- The coach generates a validated weekly plan and post-run response in the selected language.
- AI output cannot directly bypass ZidRun safety constraints.
- Provider failures do not lose saved runs or corrupt accepted plans.
- Every AI request records usage and estimated cost.
- A runner cannot access another runner's goals, runs, plans, or coach interactions.
- The workflow is usable on mobile and correct in light, dark, race, LTR, and RTL modes.
- The closed beta has documented safety review and evaluation results before public release.
