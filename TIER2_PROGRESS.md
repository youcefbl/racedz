# ZidRun — Tier 2 Feature Build (Integrations / data portability)

Tier 2 closes the integration stubs from the product review: runners can get their data in and
out. Scope this pass (per user decision **2026-07-10**): **GPX import + export.** Strava/wearable
sync is deferred to its own pass (needs a registered Strava app + secrets).

Legend: ✅ done · 🚧 in progress · ⏳ queued · ⏭️ deferred

---

## Data portability

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4.1 | GPX export (any run → `.gpx`) | ✅ | `GET /api/coach/runs/[id]/gpx` (owner-only) builds a GPX 1.1 track via `buildGpx`; "GPX" download link on each run in the runs list. |
| 4.2 | GPX import (`.gpx` → run) | ✅ | `POST /api/coach/runs/import` parses the track (`parseGpx`), derives distance/duration, creates a `RunnerRun` with `source=IMPORTED` (reuses `createRunnerRun` → same elevation/weather/calories). `gpx-import.tsx` upload card on the Runs screen (effort + public toggle). |
| 4.3 | FIT import | ⏭️ | Deferred — FIT is a binary format needing a decoder dependency; GPX covers most watch exports. |

## Wearables / Strava (deferred)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5.1 | Strava OAuth connect + token model | ⏭️ | Needs `STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET` + a registered app at strava.com/settings/api. |
| 5.2 | Strava activity → run sync | ⏭️ | Depends on 5.1. Map Strava activity → `RunnerRun` (source IMPORTED). |

---

---

## Structured workout execution (Tier 3 feature, prioritized by user 2026-07-10)

The plan says "6×400m intervals" but the recorder gave no guidance mid-run. This builds the full
guided-execution loop: a planned workout is turned into an ordered set of steps, and the recorder
walks the runner through each one with a live countdown, progress bar, and multi-sensory cues,
then links the completed run back to the plan.

| # | Piece | Status | Notes |
|---|-------|--------|-------|
| S.1 | Structure model + generator | ✅ | `src/lib/coach/workout-structure.ts` — steps/blocks/repeats, `buildWorkoutStructure` (INTERVAL / TEMPO / EASY·LONG·RACE), `flattenStructure`, summaries. **Derived at runtime** from existing `TrainingWorkout` fields → no migration, works for every existing plan. |
| S.2 | Execution engine | ✅ | `use-workout-guidance.ts` hook — auto-advances by time/distance target, anchors each step to live metrics, 3-2-1 countdown, manual skip. Pure consumer of the run engine (recording behaviour unchanged). |
| S.3 | Cues | ✅ | `src/lib/native/cues.ts` — Web-Audio beep (pitch by effort), SpeechSynthesis announcement (en/fr/ar), haptic buzz. All best-effort; primed on the Start gesture so audio works mid-run. |
| S.4 | Guidance UI | ✅ | `workout-guidance-panel.tsx` — current-step card (colour by intensity), big remaining countdown, progress bar, next-step preview, full step overview, skip. |
| S.5 | Recorder integration | ✅ | `run-recorder.tsx` — "Today's session" pre-start card with a **Start guided workout** / free-run choice; panel shown while tracking; `workoutId` attached on save so completing the run marks the workout done + advances the plan. Threaded page → RunsView → CoachRunsPanel → RunRecorder. |
| S.6 | Service | ✅ | `getTodayGuidedWorkout` returns the next PLANNED workout of the ACTIVE plan; added to `getRunsScreenData`. |
| S.7 | Deferred | ⏭️ | Coach/AI-authored *custom* structures (store a `structure` JSON on the workout); mid-step pace-target enforcement; persisting `guidedActive` across an app kill. |

---

## Tier 3 — coaching depth (built 2026-07-10)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 6 | Human-coach hybrid tier | ✅ | `CoachSubscription.humanCoaching` flag (granted at activation in `/admin/coach`); admins send a personal note per subscriber → stored as a `HUMAN_NOTE` `CoachInteraction` + an in-app `COACH_NOTE` notification. Runner reads them at `/account/coach/notes` (hub row gated on an active human-coaching sub). `postHumanCoachNote` / `getHumanCoachNotes`. |
| 7 | Nutrition & hydration | ✅ | `NutritionEntry` model; `src/lib/coach/nutrition.ts` (log/delete/day/recent + `getNutritionCoachSummary`); `/api/coach/nutrition` (+ `[id]` DELETE); `/account/nutrition` log screen (meals + water quick-add + daily totals); summary injected into the AI coach context. |
| 8 | Structured workout execution | ✅ | See section above (S.1–S.6). |

## Build log
- **2026-07-10** — GPX groundwork parked, then **completed** (export + import wired). Pivoted to **structured workout execution** and shipped it (S.1–S.6). Then closed the remaining Tier 1–3 deferrals: **badges (2.3)**, **finisher certificate (3.3)**, **GPX (4.1/4.2)**, **nutrition (7)**, **human-coach tier (6)**. Migration `20260710120000_add_nutrition_and_human_coach` applied.

## Verification (2026-07-10 batch)
- `npx tsc --noEmit` — clean.
- `npx eslint` on all changed files — clean.
- `npm run test:workout` + `npm run test:coach` — pass.
- `npx next build` — success, 50 pages; new routes present (`/account/nutrition`, `/account/coach/notes`, `/account/registrations/[id]/certificate`, `/api/coach/nutrition[/id]`, `/api/coach/runs/[id]/gpx`, `/api/coach/runs/import`).
- ⚠️ Runtime click-through still pending (esp. GPX import with a real `.gpx`, guided workouts on-device, and the print certificate layout).

## Still deferred (out of the requested set)
- **1.3 Clubs/groups**, **5.1/5.2 Strava sync** (needs a registered app + secrets), **4.3 FIT import** (binary decoder dependency).

## Verification
- `npx tsc --noEmit` — clean.
- `npx eslint` on all changed files — clean.
- `npx next build` — success (`/account/runs` compiles; client bundle OK).
- `npm run test:workout` — pure structure/generator unit tests pass (rep scaling, tempo math, targets, summaries).
- ⚠️ **Not exercised at runtime**: the recorder is native-only (`isNativeRuntime()` gates it), so it renders only in the Capacitor Android app, not a desktop browser. Needs a device smoke test: generate a plan with a TEMPO/INTERVAL day → open Runs → "Start guided workout" → confirm step advance + audio/haptic cues + countdown → finish → workout shows COMPLETED in the plan.

## New files (structured workouts)
- `src/lib/coach/workout-structure.ts`, `src/lib/native/cues.ts`
- `src/components/coach/use-workout-guidance.ts`, `src/components/coach/workout-guidance-panel.tsx`
- `scripts/test-workout-structure.ts` (+ `npm run test:workout`)
