---
name: zidrun-app-review
description: Strict review of ZidRun web, Capacitor, and native Android app work against approved screenshots, design flows, brand assets, three themes, English/French/Algerian Darija localization, accessibility, end-to-end flow parity, security/privacy, and mobile performance. Use when reviewing, auditing, comparing, polishing, or accepting any ZidRun app UI, UX, screen, flow, native implementation, or frontend change.
---

# ZidRun app review

Review existing work as a release-quality product reviewer. Do not implement fixes unless the user
also asks for implementation. Do not approve a screen because it compiles or looks acceptable in one
browser state.

## Required context

Read these before reviewing, then read only the feature-specific references needed for the surface:

1. `EXECUTION_PLAN.md` — release gates and current acceptance requirements.
2. `PRODUCT.md` — ZidRun product, brand, accessibility, and design principles.
3. `AGENTS.md` — repository architecture and working rules.
4. The relevant approved flow and screenshots:
   - Runs: `docs/runs-design/RUNS_DESIGN_FLOW.md` and `docs/runs-design/images/`
   - Races: `docs/races-design/RACE_DESIGN_FLOW.md` and `docs/races-design/images/`
   - Account: `docs/account-design/ACCOUNT_DESIGN_FLOW.md` and `docs/account-design/images/`
   - Coach: `docs/coach-design/COACH_DESIGN_FLOW.md` and `docs/coach-design/images/`
   - Auth/native shell: `docs/native-design/NATIVE_APP_DESIGN_FLOW.md` and `docs/native-design/images/`
5. `docs/MOBILE_ANDROID.md` for Capacitor behavior and device acceptance.
6. `docs/NATIVE_ANDROID_OPTION_PLAN.md` for native parity, API, and decision-gate requirements.

When a reference is missing, report it as a review limitation; do not invent a replacement design.
Use `view_image` or the available image viewer to inspect every relevant screenshot at its original
resolution. Treat screenshots and flow documents as acceptance references, not inspiration.

For frontend work, use the repository's `impeccable` skill and its critique/audit workflow. Preserve
the existing design system instead of introducing a second visual language.

## Brand and visual invariants

Verify these on every reviewed screen and state:

- Use the ZidRun logo and mark from `public/brand/` (`zidrun-logo.svg`, `zidrun-logo-dark.svg`,
  `zidrun-logo-race.svg`, and the matching marks). Do not replace them with typed text, emoji, a new
  approximation, or generated mockup artwork.
- Match the approved screenshot template: layout hierarchy, spacing rhythm, typography scale,
  control shape, icon weight, chart treatment, image crop, and navigation pattern.
- Use the existing font tokens. Web typography is defined in `src/app/globals.css`; native tokens
  live in `native-android/core/design/`. Do not silently substitute a system font or add a one-off
  font for a single screen.
- Verify light, dark, and race modes. Check contrast, borders, surfaces, controls, charts, maps,
  dialogs, keyboard states, and images in all three modes. Race mode is energetic but must remain
  readable and accessible; never accept neon text on a bright surface.
- Verify English, French, and Algerian Darija Arabic. Check both short and long strings, plural or
  count text, dates/numbers, validation/errors, empty/loading/offline states, and Arabic RTL. Do not
  treat untranslated English, clipped French, or formal Arabic that conflicts with the product copy
  as acceptable localization.
- Check `prefers-reduced-motion`, large text, screen readers, visible focus, minimum 44dp/44px touch
  targets, one-handed reach, safe areas, and outdoor readability.

## Review workflow

### 1. Establish the change surface

Identify the exact commit and changed files. Determine whether the change affects web, Capacitor,
native Android, shared API/domain behavior, or more than one client. Map every changed screen to its
approved flow and screenshot. Inspect the nearest existing Capacitor implementation before judging a
native replacement.

Use the Capacitor app as the behavioral baseline, not as permission to copy its bugs. Compare:

- entry points, navigation, back behavior, deep links, auth/account switching, and logout;
- loading, success, empty, error, offline, permission, keyboard, and recovery states;
- input fields, validation, save/discard behavior, refresh behavior, and optimistic updates;
- data visibility, ownership, privacy controls, and server-authoritative status;
- run/GPS/background behavior, notifications, and device-specific capabilities.

Flag native or redesigned flows that are missing from Capacitor parity, and flag Capacitor behavior
that the approved design or release plan says must be corrected. Do not assume a route exists because
the visual screen exists; trace the user journey end to end.

### 2. Review the UI and UX strictly

Review the rendered result at phone width first, then tablet/desktop where supported. Compare it to
the reference screenshots at the same viewport and, for native, on the same device class.

Check:

- clear first-glance purpose and one primary action;
- hierarchy, spacing, alignment, density, scroll boundaries, and thumb reach;
- readable metric labels and charts without crowding;
- consistent component states, pressed/disabled/focused feedback, and safe destructive actions;
- input focus, keyboard avoidance, cursor visibility, submit behavior, and scroll-to-field behavior;
- no dead taps, misleading affordances, hidden actions, unexpected resets, or refresh-only updates;
- meaningful loading skeletons, offline messaging, retry actions, empty states, and recoverable errors;
- motion that communicates state, has a reduced-motion alternative, and does not delay input;
- RTL mirroring that preserves meaning rather than mechanically reversing icons or maps.

Reject visual drift in font, color, radius, iconography, logo usage, or spacing even if the feature
functionally works. Record exact evidence: screenshot/device, route/state, expected reference, actual
result, and severity.

### 3. Review performance as a first-class requirement

Measure or inspect performance rather than treating it as a later optimization. At minimum check:

- web and Capacitor: cold start, route transition, first meaningful content, image sizing/lazy
  loading, JavaScript payload, unnecessary refetches, layout shift, scroll smoothness, keyboard
  response, offline fallback, and battery/network behavior;
- native Android: cold/warm start, Compose recomposition, list/map/chart scrolling, frame drops,
  memory growth, ANR risk, battery/GPS cost, background recording, network retries, and Room/API
  synchronization;
- all clients: bounded pagination, no full-history fetch for a small screen, no unbounded route or
  chart data, cancellation of stale requests, safe retry/backoff, and no blocking work on the UI
  thread.

Use project tests and available browser/device tooling. Treat these as warning thresholds unless the
feature has a stricter gate: LCP below 2.5s on a representative mobile connection, INP below 200ms,
CLS below 0.1, interactive input response below 100ms for local actions, and no sustained dropped
frames during normal scroll or live tracking. Explain the device/network and measurement method;
never present an unmeasured claim as evidence.

### 4. Verify data, privacy, and security boundaries

For every screen, confirm that it exposes only the current user's authorized data, does not leak
precise GPS/GPX, payment proof, health/coach context, tokens, owner information, local paths, or
debug details, and uses server-authoritative permissions. Check sensitive media delivery, logging,
analytics, screenshots, and error states when the surface handles private data.

For forms and mutations, verify validation, authorization, rate limiting, idempotency where needed,
safe redirects/deep links, session expiry/logout, and account switching. Include negative tests with
another runner, organizer, and admin where relevant.

### 5. Run proportionate verification

Run the smallest useful checks, then expand for release-impacting changes:

```bash
npm run lint
npm run typecheck
npm run check:native-i18n
```

For relevant web flows, run the focused test or Playwright/visual test. For native changes run:

```bash
cd native-android
./gradlew lintDebug testDebugUnitTest
```

For API/auth/data changes, read `docs/TESTING.md` and run the focused contract/security suite. For
release or device claims, follow `docs/MOBILE_ANDROID.md`, use a signed candidate where required,
and record device, OS, app version, locale, theme, network, and result. A passing build is not proof
of UI, flow, localization, parity, or performance quality.

## Findings and approval bar

Report findings first, ordered by severity:

- `P0`: release blocker, data exposure, broken auth/privacy, unsafe destructive flow, unusable core
  journey, or severe performance failure;
- `P1`: major feature/flow failure, missing client parity, broken locale/theme, accessibility failure,
  or performance regression affecting normal mobile use;
- `P2`: meaningful UI/UX inconsistency, missing state, moderate usability/performance issue, or weak
  test evidence;
- `P3`: polish or low-risk maintainability issue.

Each finding must include the exact file/line or screen/state, impact, reproduction/evidence, and a
concrete acceptance condition. Distinguish confirmed defects from risks and untested areas. Do not
call a change approved when any P0/P1 remains or when the required modes/locales/client comparison was
skipped. End with a compact verification report and explicitly list what was not tested.

## Review checklist

Before approval, answer yes or no for each applicable item:

- [ ] Approved screenshot and flow matched.
- [ ] Capacitor behavior compared with native/web behavior.
- [ ] ZidRun logo/mark and existing font/color tokens verified.
- [ ] Light, dark, and race modes checked.
- [ ] English, French, and Algerian Darija Arabic/RTL checked.
- [ ] Loading, empty, error, offline, permission, keyboard, and recovery states checked.
- [ ] Accessibility and one-handed outdoor use checked.
- [ ] Performance measured or explicitly marked untested.
- [ ] Privacy, authorization, and sensitive-data exposure checked.
- [ ] Focused automated checks passed and device limitations recorded.
