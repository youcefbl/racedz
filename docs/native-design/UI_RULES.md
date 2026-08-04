# ZidRun UI Rules — DRAFT, pending owner approval

> **Status: PROPOSED, not yet binding** (NDP-R01). This draft becomes the design reference only
> after the owner answers the four approval asks in
> `proposals/2026-08-04/RECOMMENDATION.md` (variant, empty-state direction, numerals,
> typography). Where a rule below depends on one of those asks it is marked **[pending ask]**.
> It sits alongside `PRODUCT.md` (brand + principles) and the flow docs
> (`docs/*-design/*_DESIGN_FLOW.md`); where those describe intent, this file states the rules a
> change must satisfy before it ships. If a change cannot satisfy a rule, the rule is challenged
> in review — never silently broken. Durable product decisions (typography, numerals) belong in
> `PRODUCT.md` once made; this file then references them.

## 1 · Tokens are the only source of colour

Colours come from `native-android/core/design/Color.kt` (native) and `src/app/globals.css` (web).
**Never hand-pick a colour on a screen; add a token or use an existing one.**

**Platform scope (NDP-R06):** light and race palettes match across web and native; the **dark
palette deliberately diverges** — native dark uses near-neutral charcoals
(`#0A0A0B`/`#151517`, documented in `Color.kt`) while web dark uses slate blues
(`#080D18`/`#101827` in `globals.css`). The table below is the **native** set; judge web work
against `globals.css`, and never carry a contrast ratio computed for one platform's dark surface
to the other.

| Token (native) | Light | Dark | Race |
|---|---|---|---|
| background | `#F9FAFB` | `#0A0A0B` | `#090511` |
| surface | `#FFFFFF` | `#151517` | `#160B24` |
| surfaceMuted | `#F3F4F6` | `#1F1F22` | `#251039` |
| surfaceStrong | `#111827` | `#000000` | `#05020A` |
| textStrong | `#111827` | `#FAFAFA` | `#FFF7FF` |
| text | `#374151` | `#D4D4D6` | `#F2DDFF` |
| textMuted | `#6B7280` | `#9B9BA1` | `#CFB6DF` |
| border / borderStrong | `#E5E7EB` / `#D1D5DB` | `#2A2A2E` / `#3D3D42` | `#45205E` / `#7133FF` |
| primary / onPrimary | `#15803D` / `#FFFFFF` | `#4ADE80` / `#04240F` | `#39FF14` / `#0A1A05` |
| primarySoft | `#ECFDF3` | `#0E2A18` | `#102B0A` |
| accent / accentStrong | `#F47A20` / `#EA580C` | `#FB923C` / `#F47A20` | `#FF2BD6` / `#C026D3` |
| accentSoft | `#FFF3E9` | `#2E1508` | `#3B0A34` |
| info / infoSoft | `#2563EB` / `#EFF6FF` | `#60A5FA` / `#10203A` | `#9B5CFF` / `#211039` |
| danger | `#DC2626` | `#F87171` | `#FF3864` |
| heroAccent / onHeroAccent | `#A3E635` / `#0A1A05` | same | `#39FF14` / `#0A1A05` |

Hard colour rules, measured (WCAG ratios computed from these exact values):

- **Light theme: orange is never text** (NDP-R09). `accent #F47A20` is 2.74:1 on white and
  `accentStrong #EA580C` is only 3.55:1 — text uses ≥4.5:1 tokens regardless of size; orange
  lives on icons, chips with `accentSoft` fills, and button fills with `onAccent` text. (No
  "large text" exception: sp-based size/weight claims don't prove the WCAG large-text threshold
  on a given device.)
- Dark accent (8.06:1) and race accent (5.93:1) pass as text; the ban above is about light.
- `textMuted` is the floor for legible text (4.63:1 light bg — do not lighten it further).
- Race-theme borders (`#45205E`, 1.46:1) are decorative; never make a border the only affordance.
- Hero surfaces (`surfaceStrong`) are dark in every theme; text on them uses white/`heroAccent`,
  action fills use `heroAccent` + `onHeroAccent`.

## 2 · Type and spacing

- One family: **Manrope** (variable), weights ≤ 600 — headings are SemiBold, never Bold+.
  **[pending ask #4]**: PRODUCT.md still names Audiowide as display face; the shipped token
  system is deliberately Manrope-only. Manrope is what ships today; the owner's decision lands
  in `PRODUCT.md`.
- Scale = `Type.kt` / Material roles only; no ad-hoc sizes. Numbers that update or align use
  tabular numerals (`ZidRunFormat`, `font-variant-numeric: tabular-nums`).
- Spacing and radii from `ZidRunDimens` (4/8/12/16/24/32; corners 8/12/16/pill). Touch targets
  ≥ 44dp — no exceptions, including icon-only actions.

## 3 · Layout rules (from the proposed redesign)

- **The page's primary action is visible without scrolling at every scroll position**, in the
  lower thumb zone. **Scope: the Runs overview** (the pinned Record dock, Variant B,
  **[pending ask #1]**); extending the pinned-dock pattern to another screen needs its own flow
  justification — this is not a universal law. Top-of-screen hero buttons are not a substitute.
- **The dock is stateful and never destructive** (NDP-R05): it shows *Record* only when the
  recorder is Idle; *Resume — recording · X km* for Recording/Acquiring/Paused; *Save your run*
  when a finished recording is pending. `RunRecorder.start()` must refuse to replace a non-idle
  recording without an explicit discard confirmation — implementation acceptance, not just UI.
- **One fact, one card.** Never two cards repeating the same stat (the double "This week" card
  is the canonical violation). Merge before adding.
- **Never remove shipped runner controls in a redesign.** A proposal that restyles a screen keeps
  every existing action (export, privacy, analyze, delete) unless the owner explicitly retires
  one (NDP-R02).
- Content order answers, in order: what's my status → what happened last → what can I do —
  with the action never below the fold.
- Screens that record or track (create-run, during-run, save-run) render on the dark surface in
  all three themes.
- Scroll content under a pinned dock gets bottom padding + a background gradient scrim so nothing
  hides behind the dock at 1.3× font.

## 4 · Accessibility bar (every change, all three themes)

- WCAG AA: 4.5:1 body, 3:1 large text and UI components — **checked by computation against the
  token values, not by eye**, in light, dark AND race. Race is policed hardest.
- ≥ 44dp targets; TalkBack labels on icon-only actions; visible focus; no colour-alone signals.
- Every animation has a `prefers-reduced-motion` / Android reduce-motion alternative (see §7).
- Verify at 1.3× font scale — truncation must be deliberate (ellipsis), never clipped.

## 5 · Trilingual + RTL rules

- en / fr / ar (Algerian Darija) are equal locales; `check:native-i18n` parity is a gate.
- Arabic is true RTL: layout mirrors via start/end properties, direction-carrying icons mirror
  (AutoMirrored), activity icons and route geometry do not.
- **One numeral system per surface** — never mix Arabic-Indic and Latin numerals in one card.
  Proposed: Western digits (0-9) for ar-DZ, the Algerian convention **[pending ask #3]**.
- Plural resources always (`plurals`, ICU) — "1 runs" / "1 سورتيات" class bugs are release blockers.
- The bottom tab bar mirrors in RTL — automated UI tests must not use fixed tab coordinates.

## 6 · Charts and metrics (dataviz rules, applied)

- **One metric per chart, one hue per chart; the card title names the metric** — identity never
  rides on colour alone. Standing assignments: pace/splits → `primary`; elevation → `info`;
  cadence → `accent`. Status colours (danger etc.) are never used as series colours.
- Marks: bars 8–10dp thick with 4–5dp rounded data ends anchored to the baseline; lines 2dp;
  emphasized endpoint dot ~3.5dp; grid = 1dp `border`; axis text 11sp `textMuted`.
- **Never a dual-axis chart.** Two measures = two cards.
- Direct labels are selective (fastest/slowest, peak, endpoint) — never a number on every mark;
  full values arrive via tap (native) and always exist in an accessible description.
- Splits bars: length ∝ speed (longer = faster), labelled with pace, fastest/slowest tagged with
  a chip — chip + label is the secondary encoding that makes the highlight colour optional.
- The week-hero fill bar only fills with real kilometres — no minimum-fill floor at zero.
- **A chart only exists for data the product actually collects** (NDP-R02/R04): no cadence
  series anywhere until a real sensor source, storage, API, and absence states are designed —
  the recorder has no cadence input and the run DTO carries only a scalar `avgCadence`. Charts
  render from real series or honest placeholders; no invented axes or smoothing that changes
  what happened. When a series is legitimately empty (e.g. a route without timestamps or
  elevation), the card states why rather than disappearing silently.

## 7 · Motion

- Motion is feedback, not decoration: 150–250ms state transitions; charts draw once, then stay.
- **Hold-to-start** (spec in `proposals/2026-08-04/run-start-hold-dark.png`): press-progress ring
  ≈700ms ease-out; releasing rewinds (150ms) and never starts; completion = one aura pulse
  (300ms, no loop) + one haptic tick + ≤200ms crossfade into the live screen. Reduced motion:
  static 0/60/100% ring states, instant swap, same haptic. The label stays readable throughout;
  the foot control never degrades into a generic spinner.
- No continuous decorative animation, parallax, or flashing neon; nothing that makes a live
  metric harder to read outdoors.

## 8 · Brand energy ("earned energy")

- Energy lives at: hero surfaces, **empty states**, achievements/PRs, race-day (race theme).
  Task surfaces (forms, payment, consent, settings) stay calm.
- Empty states are brand moments: the Z mark, one message (never repeated twice on one screen),
  and **exactly one primary action** (NDP-R07) — on the Runs overview that action is the pinned
  dock, so the empty hero carries the message, not a second CTA. No fake progress indicators,
  and no quietly-added navigation to other tabs without a defined destination, entitlement, and
  offline behaviour. **[empty-state art direction pending ask #2]**
- The ZidRun logo and Z mark are the canonical vectors in `public/brand/` — never redrawn,
  recoloured, or dropped. Wordmark per theme: `zidrun-logo(.svg|-dark.svg|-race.svg)`.

## 9 · Copy

- Direct, encouraging, local; speaks to runners. Controls say exactly what happens ("Record run",
  "Log this run"). Counters name their scope ("1 of 3 sessions this week" — never a bare ratio
  when another ratio is visible). Payment-adjacent status (trial pill, subscription) has a
  reserved slot — it may skeleton, it may not pop in and shift layout.
- Safety/consent copy is never compressed for aesthetics.

## 10 · Checklist for any UI change or new feature

Before review, confirm:

1. All colours are tokens; any new pair computed against §1's contrast rules in all 3 themes.
2. Primary action thumb-reachable and above the fold; no duplicated stat cards.
3. Renders checked in light / dark / race × en / fr / ar(RTL) × 1.3× font — screenshots
   attached. (Mockups prove layout and colour; TalkBack semantics, focus order, and system
   insets are **implementation/device acceptance items**, never claimed from PNGs — NDP-R08.)
4. Plural resources and one numeral system per surface.
5. Any animation has a reduced-motion path; any chart follows §6 (including: no series the
   product doesn't collect).
6. Touch targets ≥ 44dp; TalkBack labels specified for implementation.
7. Empty / loading / error / offline states designed, with energy only where §8 allows.
8. Mockup-first for visual changes: token-accurate HTML renders (see
   `proposals/2026-08-04/src/`) approved by the owner before Compose work.
