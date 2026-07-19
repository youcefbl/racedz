# Coach Phase 2 — Adaptive planner: build, simulation & tweak plan

Companion to [execution-plan-coach.md](execution-plan-coach.md). Records what the adaptive planner does
today, a profile simulation of what it produces, and a prioritized list of context/BE tweaks the review
surfaced — the iteration loop the product owner asked for.

## What shipped (Phase 2, first increment)

- **`src/lib/coach/adaptive-planner.ts`** — a pure, deterministic engine (`buildAdaptivePlan`). It owns
  training phase, weekly load progression, session mix, long-run growth, and safety reductions; the AI
  only explains/personalizes the result. Versioned (`ADAPTIVE_PLANNER_VERSION`).
- **Wired into both generation paths** (`service.ts`): the AI interaction flow and the no-AI weekly
  rollover (`ensureCurrentWeekPlan`) now build the week from the adaptive planner instead of the flat
  skeleton, using real adherence as input.
- **Phase + adaptations now flow to the AI context** (`trainingPhase`, `planAdaptations`) — the coach can
  name the phase and explain *why* a week was eased, instead of guessing from the workout list.

## How it works

- **Phase** from weeks-to-race (+ fitness): `BASELINE → BASE → BUILD → PEAK → TAPER → RECOVERY`
  (2w→taper, 4w→peak, 9w→build, else base; beginners with low volume start at baseline; a break →
  baseline rebuild; general-fitness stays in a sustainable base).
- **Weekly volume**: anchored on recent actual × a phase factor × a goal multiplier, capped by the ~10%
  progression rule, known peak volume, and a hard experience ceiling (45/90/150 km).
- **Session mix**: one long run (a goal-specific share of volume, capped vs recent longest & shortened in
  taper), 0–2 quality sessions (spaced, never back-to-back, never the day before the long run), rest easy.
  Quality type follows the goal (5K → intervals, half/marathon → tempo).
- **Adaptation**: recent pain −30%, high fatigue −15%, ≥2 missed/consecutive-missed −10% — each recorded
  as a human-readable note in `adaptations`.

## Simulation — three profiles through the real service

Generated via `ensureCurrentWeekPlan` (the real path) with seeded run history, then cleaned up:

```
Beginner · 5K (8w out)        BUILD   12.0 km/wk · 4 sessions · long 4 km · 1× INTERVAL
  Fri EASY 2 · Sat LONG 4 · Mon INTERVAL 4 · Wed EASY 2

Intermediate · Half (10w out) BASE    44.8 km/wk · 5 sessions · long 14.8 km · 1× TEMPO
  Sat EASY 7.3 · Sun LONG 14.8 · Mon TEMPO 8.1 · Tue EASY 7.3 · Thu EASY 7.3

Advanced · Marathon (12w out) BASE    80.0 km/wk · 7 sessions · long 30.5 km · 1× TEMPO
  Fri TEMPO 12 · Sat EASY 7.5 · Sun LONG 30.5 · Mon–Thu EASY 7.5
```

**Exit criteria met:** the three profiles are meaningfully different (volume 12 / 45 / 80, long run
4 / 15 / 30, quality type intervals vs tempo); the target date drives the phase (verified BASE→BUILD→
PEAK→TAPER as weeks-out shrink); and fatigue/pain/missed sessions reduce the week (unit-tested: baseline
44.8 → fatigue 38.1 → pain 31.4 → missed 40.3). 19/19 planner unit checks pass.

## Review → prioritized tweaks

What the simulation exposed, ordered by leverage. (#1 already done this pass.)

1. **✅ Phase + adaptations → AI context.** *(done)* The planner's `phase` and `adaptations` were being
   discarded before reaching the coach; now threaded through so feedback can say "you're in your base
   weeks" and "I eased this week after two missed runs."

2. **✅ Long-run cap now uses *actual* recent longest.** *(done 2026-07-18)* The planner capped long-run
   growth against `goal.longestRecentRunKm`, frozen at goal-creation, so the cap never moved and long runs
   stalled for the whole block. `CoachMetrics` had no longest-run field at all, so the fix added
   `longestRunLast28DaysKm` (computed from run history) and the planner now caps against
   `max(onboarding, actual)` — the onboarding value still covers runners with no history.
   Guarded by `scripts/test-adaptive-planner.ts`, which was confirmed to fail on the old behaviour
   (a runner built up to 18 km stayed pinned at the 12 km onboarding-derived cap).

3. **✅ Numeric pace targets on every session.** *(done 2026-07-19)* Sessions carried distance + a verbal
   intensity but no pace. The planner now derives `targetPaceSecondsPerKm` from the runner's own recent
   average pace (recovery +18%, easy +10%, long +8%, tempo −7%, interval −12%), stored on a new nullable
   `TrainingWorkout.targetPaceSecondsPerKm` column, rendered on the plan card, and passed to the AI as
   authoritative data. Deliberate choices: paces are derived **only** from actual recent running (never
   from goal race pace), so a runner with no history gets *no* target instead of an invented one;
   implausible reference paces are rejected by sanity rails; and a safety-reduced session drops its pace
   entirely rather than carrying a tempo pace onto a recovery jog. **Live-verified:** asked what pace to
   run its tempo at, the coach replied "about 5:07/km (307 sec/km)" — exactly the computed target.

4. **✅ Beginner quality is now strides, not structured intervals.** *(done 2026-07-19)* A beginner's
   quality slot became an "Easy run + strides" session (4–6 × ~20s relaxed pickups in the last third),
   stored as an `EASY` workout type since that is what it is. Intermediates and above are unchanged —
   an intermediate 5K runner still gets true intervals. Progressing beginners *on* to real intervals once
   they hold volume is a deliberate follow-up, not part of this change.

5. **Beginner sessions could be duration-based.** `targetDurationMin` is always null. Beginners train
   better on time ("run 25 min easy") than tiny distances. **Fix:** emit duration targets for beginner
   easy runs (and pass both to the UI, which already renders duration).

6. **✅ Plan summary names the phase + volume.** *(done 2026-07-19)* The generic `AUTO_PLAN_SUMMARY`
   became `buildAutoPlanSummary(locale, phase, volume)` — "Base week · ~45 km — building your endurance.
   Ask your coach any time to adjust it." — with per-phase intent copy in all three locales.

7. **✅ Coach *text* feedback validated live.** *(done 2026-07-18)* Billing was restored and the first
   live evals ran against `gpt-5.4-mini` through the real prompt + structured-output schema:
   the coach cited the actual completed/skipped sessions, the **fatigue** skip reason and the **base**
   phase (`usedSignals` named `plan adherence` / `active plan`); a sparse runner produced 5 `dataGaps`,
   exactly one `followUpQuestion` and **no invented weather**; and a prompt-injection payload placed in
   both a run note and the chat message produced neither compliance nor a prompt leak.
   *Caveat:* these ran on hand-assembled contexts via `generateCoachResponse`, so they validate the
   prompt and schema, not the DB/entitlement plumbing around them.

## Suggested next iteration

#2, #3, #4, #6 and #7 are done. **Remaining: #5 (duration-based beginner sessions)** — `targetDurationMin`
is still always null, and beginners train better on time ("run 25 min easy") than on small distances; the
UI already renders duration, so this is mostly planner work.

Two follow-ups this pass created rather than closed:

- **Progress beginners on to real intervals.** They now get strides indefinitely; once a beginner holds
  volume for several weeks, structured intervals should unlock.
- **Anchor quality paces to goal race pace where one exists.** Paces derive purely from recent average
  pace today. For a runner with a target time, tempo pace arguably belongs relative to goal pace — but
  that is goal-type-dependent and was left out rather than guessed at.

A pre-existing i18n gap was also fixed along the way: the planner emits composite "Phase · Title" headings
that `localizeWorkout` looked up whole and always missed, so **every French and Arabic runner was reading
an English plan**. Titles now translate per-segment, with the planner's full string set added in fr/ar.

Re-run the profile simulation after each change to confirm the three journeys stay distinct and safe.
