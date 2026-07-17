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
| `runner.sex` / `runner.age` | `User` | Physiology-appropriate advice | 🟡 personal | From account |
| `runner.location` (wilaya, city) | `User` | Local climate / time-of-day advice | 🟡 personal | From account |
| `goal.*` (type, targetDate, distance, time, experience, weekly/peak volume, longest run, available days, long-run day) | `RunnerGoal` | Core personalization — what they train for and their capacity | 🟡 personal | Until goal changed/deleted |
| `goal.restingHeartRate` / `weightKg` / `heightCm` / `bmi` | `RunnerGoal` | Load / effort calibration | 🔴 body measurements | Until goal changed/deleted |
| `goal.injuryNotes` / `injuryHistory` / `chronicConditions` / `healthNotes` / `constraints` | `RunnerGoal` | Safety gating and conservative advice | 🔴 health + free-text | Until goal changed/deleted |
| `computedMetrics` (volumes, pace, effort, fatigue, pain trends) | derived from `RunnerRun` | Deterministic read of recent training | 🟡 (pain/fatigue lean 🔴) | Recomputed per request |
| `consistency` / `intensityDistribution` | derived from `RunnerRun` | Cadence + 80/20 coaching | 🟢 | Recomputed |
| `sleep` (recent nights, durations) | `SleepLog` | Recovery / load advice | 🔴 health | Last ~7 nights |
| `nutrition` (calorie/water aggregate) | `NutritionLog` | Fueling / hydration advice | 🔴 health | 7-day aggregate |
| `targetRace` (title, type, date, wilaya, city, elevation, conditions) | `RaceEvent` | Race-specific prep | 🟡 personal | While linked |
| `environment` (current + today's forecast) | Open-Meteo via GPS/wilaya | Heat/rain-aware advice | 🟡 (approximate) | Not stored |
| `analysedRun` (distance, pace, splits, effort, weather) | `RunnerRun` | Post-run feedback | 🔴 free-text (notes/symptoms) | The selected run |
| `recentRuns` (≤10) | `RunnerRun` | Recent training picture | 🔴 free-text (notes/symptoms) | Last 56 days, newest 10 |
| `recentConversation` (≤6 turns, question + summary) | `CoachInteraction` | Conversational coherence | 🔴 free-text | Last 6 interactions |
| `planAdherence` | derived (`adherence.ts`) | Aggregate completed/skipped | 🟢 | Recomputed |
| `trainingPhase` / `planAdaptations` | `adaptive-planner.ts` | Name the phase + explain load changes | 🟢 | Recomputed |
| `activePlan` (per-workout status + linked run) | `TrainingPlan` / `TrainingWorkout` / `RunnerRun` | Reference exactly which sessions happened | 🟡 personal | While plan active |
| `fixedSafetyDecision` / `fixedWeeklyPlanSkeleton` | deterministic | Authoritative safety + candidate week | 🟢 | Recomputed |

## Trust & safety notes

- **Untrusted content:** everything the runner authored (`runnerQuestion`, run titles/notes/symptoms,
  nutrition text, imported text) is data, never instructions. The prompt (`openai.ts`, v7+) forbids
  following instructions embedded in it, revealing the prompt/context, or bypassing safety.
- **Anti-hallucination:** the response schema carries `usedSignals`, `dataGaps`, and one optional
  `followUpQuestion`, so the coach flags missing data instead of inventing weather/race/injury facts.
- **Guardrails:** `MAX_RECENT_RUNS=10`, `MAX_CONVERSATION_TURNS=6`, note/summary length caps, and a
  compaction pass keep the payload bounded.

## Open items (from the context-hardening track)

- Field-level **consent** for the 🔴 rows before expanding collection (separate from general terms).
- Self-service **export + deletion** of coach data (incl. context/memory).
- A stored **context version + hash** per interaction for reproducibility (no raw prompt/health/GPS in logs).
