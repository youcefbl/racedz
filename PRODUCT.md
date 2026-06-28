# Product

## Register

product

## Users

Runners across Algeria — from first-time 5K entrants to regular racers — plus race organizers and platform admins. Runners are usually on a phone (the app ships as an Android/Capacitor build and the web is mobile-first), often on the go, sometimes on slower mobile connections. They speak Arabic, French, or English and may read right-to-left. The job to be done: **discover a race, register and pay with confidence, and manage their entries** — with organizers needing to publish/manage events and admins approving and moderating.

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
