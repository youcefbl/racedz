# Recommendation — Runs + Coach redesign (2026-08-04)

**Status (2026-08-04, end of day): Phases 1–4 are implemented on `feat/coach-tier0`** — see the
dated rows in `EXECUTION_PLAN.md`, the only status tracker. Of the four asks below: **#1 is
decided (Variant B**, owner: "Variant B is the best overview direction", conditions remediated);
**#2–#4 remain open** and their implementations are provisional — recorded as such in
`PRODUCT.md` ("Product decisions — Runs/Coach redesign"). This file stays as the dated proposal
record; it no longer reflects current status.

## Which variant

**Variant B — sticky thumb-zone**, plus the shared fixes that apply to every variant:

1. Merge the two "This week" cards into one hero (distance + run count + streak) — R2/R7.
2. Pin **Record run** in a dock above the tab bar with a gradient scrim; content scrolls
   beneath it — R1, PRODUCT.md principle 2. **The dock is stateful (NDP-R05):** Record only
   when the recorder is idle; "Recording · X km — Open run" / "Resume" while a recording
   exists; "Finish saving your run" when a finished recording is pending. Paired with a
   `RunRecorder.start()` guard that refuses to replace a non-idle recording without an
   explicit discard confirmation. See `dock-states-light.png`. Scope: the Runs overview only.
3. Empty state gets the brand moment: Z mark, one message once, and **exactly one primary
   action — the pinned dock** (NDP-R07; no in-card CTA, no Coach promotion row); the fill bar
   no longer renders its 8% floor at zero — R4.
4. Plural resources respected ("1 run", not "1 runs"; same in ar/fr) and one numeral system
   per card in Arabic (Western digits, the Algerian convention) — R5.
5. Light theme stops using orange as text entirely — icons, chips and fills only; all text
   uses ≥4.5:1 tokens regardless of size (R3 + NDP-R09; no "large text" exception).
6. Coach: reserved entitlement-pill slot (C2) and scope labels on both adherence counters
   (C1). No structural Coach changes — its action-first shape is already right.

## Why B over A and C

- **A (hero-top)** answers the complaint but parks the action in the least thumb-reachable
  area of a 6.5" phone; PRODUCT.md explicitly asks for thumb-reachable primary actions.
- **C (restructure)** is the boldest statement and the best race-day surface, but it demotes
  "how is my week going?" — the question the flow doc says this page answers first — and it
  duplicates the record screen's job while costing the most to build. Worth revisiting as a
  later experiment once B has telemetry.
- **B** is the smallest honest change that makes the action visible at *every* scroll
  position, in the zone thumbs already occupy, without sacrificing the momentum-first read.

## What round 2 actually is (corrected per NDP-R02/R03)

The build **already renders** splits, pace and elevation charts conditionally
(`RunDetailScreen.kt:182-289`) from API-derived series; the seeded capture showed none because
the seeded route points lacked timestamps/elevation, so every series was empty. Round 2 is a
**restyle of those existing charts** plus honest empty-series states — not new chart
infrastructure. There is **no cadence chart** (no cadence series exists anywhere in the
product), and the during-run surface **keeps the trusted-route map** with explicit
acquiring/stable/auto-paused/paused states (`run-live-states-dark.png`). The run-detail
mockup retains every shipped control: Analyze run, Export GPX, Visibility, Delete.

## What it costs to build

Contained in `feature/runs` + strings, but larger than the first estimate because of the
stateful dock:
- `RunsOverviewScreen.kt`: dock anchored `Alignment.BottomCenter` + gradient, driven by
  `RunRecorder.state` (idle / recording / paused / pending-save); delete `WeekCountCard`,
  fold streak into `WeekHeroCard`, remove the 8% fill floor in the empty case.
- `RunRecorder.start()`: refuse to replace a non-idle recording without explicit discard —
  the guard NDP-R05 requires, with a test.
- Run detail: restyle the existing splits/pace/elevation composables (pace line moves off
  orange in light); add "why this chart is empty" states for timestamp-less routes.
- Plural resources for the run count; Coach pill slot + two scope-label strings; light-theme
  "Next workout" kicker to icon-tint orange.
- No navigation or API changes. Estimated: **two focused days** including the
  three-theme × en/fr/ar × font-scale re-verification on device and the recorder-guard test.

## Risks

- The dock covers ~64 dp of scroll viewport; on very small screens with 1.3× font the last
  card needs bottom padding (mockup includes it) or it hides behind the scrim.
- A pinned primary button invites accidental taps while scrolling — the record screen's
  press-and-hold start (unchanged) is the safety net; the dock only navigates.
- Race-theme neon dock is loud by design; if the owner reads it as "vibrating", the calmer
  `primaryStrong` fill is the fallback (both pass AA, measured).
- The RTL render assumes Western digits for ar-DZ; if the owner prefers Arabic-Indic
  numerals, pick one system per card — the current mixed state is the only wrong option.
- TalkBack semantics, focus order, and gesture/three-button-nav insets are **implementation
  acceptance items** — PNGs cannot prove them (NDP-R08).

## Approval asks

1. Pick a variant (B recommended) — or ask for a hybrid.
2. Confirm the empty-state direction (lime hero on dark surface).
3. Confirm Western digits for Arabic.
4. Decide the Audiowide question: PRODUCT.md names it as the display face, but the shipped
   token system (web + native) is deliberately Manrope-only. These mockups follow the
   tokens. Either reconcile PRODUCT.md or commission a separate display-face pass.
