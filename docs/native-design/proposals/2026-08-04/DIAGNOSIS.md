# Runs + Coach UI/UX diagnosis — device evidence, 2026-08-04

**Status: proposed design pending owner approval. No Compose code was changed in this pass.**

## Method

Captured from the real connected device over `adb` against the local dev stack
(`adb reverse tcp:3003`), signed in as the seeded test account
`device.tester@zidrun.test` (15 runs across 6 weeks, one 10K PR, an active 10K goal, a
rule-based plan week with completed and skipped sessions, 3 coach interactions).

- **Device:** Samsung SM-M215G (Galaxy M21), Android 13, 1080×2340 @ 420 dpi (~6.5" panel).
  Note: this is not the OPPO PLG110 used in earlier sessions; it is what was connected today.
- **Captures:** `docs/native-design/current/2026-08-04/` — every Runs/Coach surface in
  light / dark / race, plus a full Arabic RTL pass, a 1.3× font-scale pass, empty states,
  and the trial vs subscribed Coach states.
- Contrast ratios below are computed from the exact `core/design/Color.kt` token values
  (ported 1:1 from `globals.css`), not eyeballed.

## Findings — Runs

### R1 · CRITICAL — The page's primary action is below the fold
Evidence: `runs-overview-{light,dark,race}.png` vs `runs-overview-scrolled-*.png`.

With any real data, the scroll order is: brand bar → header block → week hero card →
week count card → latest run → personal bests → **Record run**. On a 1080×2340 screen the
button's top edge sits ≈1990 px down a ≈2100 px viewport — effectively invisible; at 1.3×
font scale it is two full swipes away. The runs design flow says the overview must answer
"What can I do next?" *immediately*; PRODUCT.md principle 2 demands thumb-reachable primary
actions. The owner's complaint is confirmed exactly as stated.

The Coach tab proves the codebase already knows better: "Today's workout" + **Log this run**
are above the fold (`coach-overview-trial-light.png`). The Runs tab is the outlier.

### R2 · MAJOR — Two stacked cards both titled "This week" repeat one fact
Evidence: `runs-overview-light.png`.

The dark hero says "This week — 9.2 km — 1 run · 9.2 km". Directly beneath, a second card
says "This week — 1 — runs — 7 week streak". The run count is stated twice; the second card
spends ≈560 px of prime viewport on a single digit plus a streak line. This double spend is
*why* the Record button falls off screen. It is also the "hero-metric template" the
PRODUCT.md anti-references warn against.

### R3 · MAJOR — Light-theme orange accent used as text fails WCAG AA
Measured: `accent #F47A20` on `surface #FFFFFF` = **2.74:1**. Fails 4.5:1 body and even the
3:1 large-text bar. Visible on the Coach overview's "Next workout" card heading
(`coach-overview-trial-light.png`) — an 18 sp semibold title in pure accent orange.
Dark theme (`#FB923C` on `#151517` = 8.06:1) and race theme (`#FF2BD6` on `#160B24` =
5.93:1) pass; **light is the broken one**. Fix: in the light theme orange is never text at
any size (even `accentStrong` is only 3.55:1) — recolor labels to ≥4.5:1 ink and keep orange
on icons, chips and fills (per NDP-R09; sp-size claims don't prove the WCAG large-text bar).

### R4 · MAJOR — Empty state has no earned energy, and lies a little
Evidence: `runs-overview-empty-{light,dark,race}.png`.

PRODUCT.md principle 4 names empty states as exactly where the athletic identity should
show up. What ships: a small grey generic runner icon, and the line "Your first run will
appear here." rendered **twice in the same viewport** (once in the week-count card, once in
the status view). The week hero's fill bar also renders its 8% minimum fill at 0.0 km —
a progress bar showing progress that does not exist. The one bright spot: the Record button
is visible when the page is empty — the moment it gains data, it disappears below the fold
(see R1).

### R5 · MINOR — Pluralization and numeral bugs
"**1 runs**" (all themes, en) and "1 **سورتيات**" (ar) — the count card bypasses the plural
resources. In RTL the latest-run card mixes Arabic-Indic (٩٫٢٠ كم) and Latin (6:11/km,
56:53) numerals in one metric row (`runs-overview-light-ar.png`).

### R6 · MINOR — The most important control has the least visual weight
The Record row is a standard 48 dp button; the statistics cards above it are 3–6× its
height. The page's biggest tap targets are read-only cards.

### R7 · MINOR — Wasted vertical space
The week-count card (R2) and the plan-week screen's bottom half (`coach-plan-week-light.png`)
leave large dead zones on a 6.5" screen while the content that matters scrolls away.

## Findings — Coach

### C1 · MAJOR — Two adherence ratios with no scope labels
Coach overview ring: "**3 of 6** — Sessions completed" (whole plan). Plan-week header:
"**1 of 3** sessions" (this week). Both are correct; neither says which scope it counts.
Seen side by side (`coach-overview-trial-light.png` → `coach-plan-week-light.png`) they read
as a contradiction. Trust-before-flair (principle 1) applies: numbers that look inconsistent
erode the surface that asks for payment.

### C2 · MINOR — Trial pill pops in late
The "Free trial" entitlement pill is present on the RTL capture (تجربة مجانية) but absent on
the same-state EN light/dark captures taken ~1.5 s after tab open — it arrives with an async
fetch and shifts the header when it lands. A payment-adjacent status should have a reserved
slot, not a layout shift.

### C3 · OBSERVATION — Coach's structure is the model to copy
Goal chip → today's workout with instructions → one primary action → week ring → next
workout. This is action-first and calm. The Runs redesign should converge on this shape,
not invent a second language. (Also: the record/live-run surfaces render on the dark
surface in **all** themes — a deliberate, correct call that the proposals keep.)

### C4 · MINOR — Planner copy is English on Arabic screens
Workout titles/instructions ("Easy aerobic run", "Relaxed effort on flat ground…") render
in English inside an otherwise Arabic UI (`coach-plan-week-light-ar.png`). The seeded data
mirrors what the rule-based planner emits today; darija phrasing for planner output is a
known gap (see coach audit memory) and predates this pass.

## Token-system note (affects mockups)

PRODUCT.md's brand section names **Audiowide** as the display face, but the implemented
system — web `globals.css` `--font-sans`/`.font-display` and native `Type.kt` — is
**Manrope-only, deliberately** ("hierarchy from size/spacing/weight, not extra display
faces", weights capped at 600). The mockups below follow the implemented tokens (Manrope);
if Audiowide is genuinely wanted back, that is a separate owner decision that would touch
every screen, and PRODUCT.md should be reconciled either way.

Race-theme contrast, measured and healthy where it counts: text 14.95:1, muted text
10.30:1, neon primary 14.87:1, pink accent 5.93:1. The race theme's weak spot is borders
(`#45205E` on surface = 1.46:1) — decorative only, never a sole affordance.

## The three variants (see contact sheet)

| | Variant | One-line ergonomic trade-off |
|---|---|---|
| A | **Hero-top** — Record leads the page, stats demoted below | Maximum prominence, worst thumb reach: the top of a 6.5" screen needs a grip shift or second hand. |
| B | **Sticky thumb-zone** — stats scroll, Record pinned above the tab bar | Always visible *and* always reachable; costs ~64 dp of scroll viewport permanently. |
| C | **Restructure** — the page *is* "start a run"; stats/history become secondary | Strongest intent, but demotes weekly momentum to a tap away and duplicates the record screen's job. |

**Recommendation: Variant B**, with the R2 merge (one week card: distance, count, streak),
R3 recolor, R4 energetic empty state, and R5 plural fixes folded in. Reasoning and cost in
`RECOMMENDATION.md`.
