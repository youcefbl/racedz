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

2. **Long-run cap should use *actual* recent longest, not the static goal field.** The planner caps
   long-run growth against `goal.longestRecentRunKm`, which is frozen at goal-creation. As the runner
   completes longer runs, the cap never moves, so long runs stall. **Fix:** derive the recent longest from
   run history (metrics) and pass that in. High value for multi-week progression accuracy.

3. **Numeric pace/effort targets on quality sessions.** Sessions carry distance + a verbal intensity
   ("comfortably hard") but no pace. **Fix:** derive target paces from `averagePaceLast28Days` (easy/long
   = +8–12%, tempo = −5–8%) or from `targetTimeSeconds` when set. Makes tempo/interval sessions actionable
   and gives the coach concrete numbers to reference.

4. **Beginner quality should be gentler than structured intervals.** The 5K beginner got a structured
   INTERVAL at 12 km/wk — a lot of intensity for that base. **Fix:** beginners' first quality = strides /
   light fartlek (add a `STRIDES`-style easy+ session or a "relaxed pickups" variant) before true intervals.

5. **Beginner sessions could be duration-based.** `targetDurationMin` is always null. Beginners train
   better on time ("run 25 min easy") than tiny distances. **Fix:** emit duration targets for beginner
   easy runs (and pass both to the UI, which already renders duration).

6. **Plan summary should name the phase + volume.** `AUTO_PLAN_SUMMARY` is generic. **Fix:** "Base week ·
   ~45 km — building your endurance" reads better on the plan card and reinforces the periodization.

7. **Coach *text* feedback is unvalidated — OpenAI billing is blocked** (`insufficient_quota`). The
   deterministic plan is fully testable and verified; the AI's explanation of it is not. **Owner op:**
   enable billing, then run one real interaction per profile and review whether the coach references the
   phase, the adaptations, and the runner's real numbers (the context now carries all three).

## Suggested next iteration

Do #2 and #3 together (both are small, both sharpen every plan and give the coach real numbers), then #4–#6
as a polish pass. Re-run this profile simulation after each change to confirm the three journeys stay
distinct and safe. Once billing is on (#7), extend the simulation to capture the coach's actual worded
feedback per profile and tune the prompt/context from there.
