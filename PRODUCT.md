# Product

> Stable product and design reference only. Progress, priorities, release gates, and every open TODO
> live exclusively in `EXECUTION_PLAN.md`.

## Register

product

## Users

Runners across Algeria — from first-time 5K entrants to regular racers — plus race organizers and platform admins. Runners are usually on a phone (the mobile app is the native Android client in `native-android/`, and the web is mobile-first), often on the go, sometimes on slower mobile connections. They speak Arabic, French, or English and may read right-to-left. The job to be done: **discover a race, register and pay with confidence, and manage their entries** — with organizers needing to publish/manage events and admins approving and moderating.

## Product Purpose

ZidRun is the central Algerian platform for discovering, registering for, and managing running races. It connects runners with events, gives organizers tools to publish and run their races, and gives admins approval/moderation control. There's also an AI coach and rankings layer. Success looks like a runner finding a race and completing registration without friction or doubt, and an organizer filling their event — repeatedly, across the country.

## Brand Personality

Energetic, sporty, and motivating — race-day energy without the gimmicks. Three words: **bold, athletic, dependable**. The display face (Audiowide) and the neon `race` theme carry the energy; the core product stays clean and confident so people trust it with payments and personal data. Voice is direct, encouraging, and local — it speaks to runners, not to enterprises.

## Anti-references

*(Inferred — adjust freely.)*

- Generic SaaS dashboards: gray-on-white, hero-metric template, identical icon-card grids. ZidRun is about movement and place, not analytics.
- Sterile corporate fitness apps that feel like medical software.
- Over-designed neon-everything: the `race` theme is an accent identity, not a license to make every screen vibrate. Energy is earned, not constant.
- Western-default layouts that treat Arabic/RTL as an afterthought.

## Design Principles

1. **Trust before flair.** Anything touching registration, payment, or personal data reads clean, legible, and certain. Energy lives in the edges (hero, empty states, celebration), never in the way of the task.
2. **Mobile is the real product.** Design for the phone in a runner's hand first — thumb-reachable actions, large tap targets, fast on a weak connection — then scale up.
3. **Trilingual and bidirectional by default.** Arabic RTL is a first-class layout, not a mirror hack. Copy and spacing survive in en/fr/ar.
4. **Earned energy.** The athletic, neon identity shows up where it motivates (race day, achievements, the brand surface) and steps back where it would distract.
5. **Local and credible.** Proudly Algerian and community-first, while looking like a platform people pay through without hesitation.

## Accessibility & Inclusion

- **WCAG AA contrast** across all themes (light / dark / race): 4.5:1 body text, 3:1 large text and UI components. The neon `race` theme is the one to police hardest.
- **Full RTL (Arabic)** as a first-class layout target.
- **Reduced motion**: every animation ships a `prefers-reduced-motion: reduce` alternative (crossfade or instant).
- **Mobile-first / large tap targets**: ≥44px touch targets, thumb-reachable primary actions.

## Product decisions — AI coach and native app (owner, 2026-08-02/03)

Durable owner decisions; status and evidence live in `EXECUTION_PLAN.md`, never here.

- **Coach trial is 7 days.**
- **Plan lifecycle:** a generated plan activates instantly (deterministic planner is authoritative)
  and stays easy to adjust; an explicit acceptance step is reserved for future material-change
  diffs only.
- **Consent is scaffolded ahead of the SEC-002 policy text**, and re-consent after a policy-version
  bump is a **hard gate** (403 + guidance) — no grace period during which health data flows
  without a current grant.
- **Delete-all coach memory = full erase, may re-learn.** Right-to-erase wins; the per-fact
  "Forget" action remains the never-relearn tool, and UI copy should say so.
- **MFA stays a web handoff permanently.** The hardened web `/account/security` flow is the one
  audited MFA surface; native opens it in a Custom Tab that lands signed-in via the handoff token.
  No `/api/v1` MFA endpoints will be built.
- **Cloud TTS speaks guided-run cues only** (allowlist + private cache). Free-text reply playback
  on native uses on-device TTS.
- **Ramadan mode is post-MVP** (next Ramadan ≈ Feb 2027); the deadline watch stays.
- **Capacitor is retired as a mobile target.** The native Android app (`native-android/`) is the
  only mobile client; no Capacitor parity work.

## Product decisions — Runs/Coach redesign (owner, 2026-08-04)

- **Runs overview uses Variant B** (sticky thumb-zone dock; stats scroll, the stateful Record
  action stays pinned above the tab bar). Decided by the owner in review: "Variant B is the best
  overview direction". Implementation and review status for that decision live in
  `EXECUTION_PLAN.md`, never here.
- **Still OPEN — implemented provisionally, awaiting explicit ratification** (the owner approved
  building the reviewed mockups in phases, which is not an answer to these recorded asks):
  1. the empty-state art direction (Z mark + lime headline on the dark hero surface);
  2. **Western digits for Arabic (ar-DZ)** — intended app-wide: `currentLocale()` normalizes bare
     `ar` to `ar-DZ`, but Android formats `%d` resource arguments with the raw `ar` config locale,
     so every such call site must be converted individually; the conversion is in progress, not
     complete (tracked in `EXECUTION_PLAN.md`);
  3. the display-typography question — PRODUCT.md's brand section names Audiowide, the shipped
     token system is deliberately Manrope-only; Manrope is what ships until this is decided.
  A "no" on any of these is a cheap revert; record the answers here when given.
