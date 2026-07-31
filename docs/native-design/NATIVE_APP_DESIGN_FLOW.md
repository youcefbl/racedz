# ZidRun Native Android App Design Flow

This is the unified high-fidelity design reference for the native Android proof. It applies the
Runs/Coach redesign language to launch, authentication, race discovery, and Account without creating
a second visual system.

The screenshots are visual references for Compose/Material 3 implementation. They define hierarchy,
spacing, content priority, tone, and interaction intent; they are not implementation code.

## Screens

| Screen | Purpose | Image |
| --- | --- | --- |
| Splash screen | Recognizable, calm launch state while the native shell restores session/configuration. | [01 — Splash screen](images/01-splash-screen.png) |
| Login | Trust-first sign-in with credentials, Google browser handoff, recovery, locale, and theme access. | [02 — Login](images/02-login.png) |
| Create account | Short, privacy-forward account creation with visible progress and safe defaults. | [03 — Create account](images/03-create-account.png) |
| Races page | Discover Algerian races with location, featured event, routes, dates, and direct entry to details. | [04 — Races page](images/04-races-page.png) |
| Account page | Manage identity, season momentum, registrations, preferences, privacy, and support. | [05 — Account page](images/05-account-page.png) |

Existing detailed references remain linked from the native plan:

- [Runs design flow](../runs-design/RUNS_DESIGN_FLOW.md)
- [Coach design flow](../coach-design/COACH_DESIGN_FLOW.md)
- [Race design flow](../races-design/RACE_DESIGN_FLOW.md)
- [Account design flow](../account-design/ACCOUNT_DESIGN_FLOW.md)

## End-to-end flow

```text
Splash
  ├─ active session ───────────────> Races / last safe route
  └─ no session ───────────────────> Login
                                      ├─ Sign in ───────> Races / Account
                                      ├─ Google ────────> system browser PKCE → return → app
                                      ├─ Forgot password -> recovery / verification
                                      └─ Create account -> step 1 → step 2 → verification → Races

Races
  ├─ featured/list race ───────────> Race Details → Register → My registrations
  └─ Account tab ──────────────────> Account → profile / privacy / support
```

## Screen behavior

### Splash screen

- Uses the native Android launch surface until the app is ready to render the first safe route.
- The wordmark and Z mark are the canonical ZidRun assets; the splash does not expose owner,
  environment, framework, API, or infrastructure details.
- Session restoration, remote config, and safe-route resolution happen behind the visual state.
- If startup fails, the app transitions to a clear retry/offline state rather than hanging on the
  splash indefinitely.
- Motion is brief and optional; reduced motion uses a static mark and instant handoff.

### Login

- Form order is email → password → recovery → primary sign-in → Google handoff → create account.
- Fields are keyboard-safe, support autofill, announce errors inline, and keep the primary action
  reachable above the keyboard.
- Sign-in errors do not reveal whether an email exists. Rate limits and step-up/MFA states are explicit.
- Google sign-in uses the system browser with authorization-code + PKCE; tokens never appear in URLs,
  logs, clipboard, screenshots, analytics, or push payloads.
- Locale and theme controls are visible but secondary to the authentication task.

### Create account

- The first step asks only for identity, email, password, and consent; profile enrichment is optional.
- `Step 1 of 2` is visible and the next action remains stable while validation updates inline.
- Password guidance is concrete and accessible; errors are adjacent to the field and do not shift the
  entire form unpredictably.
- Account creation is idempotent and safe to retry. Verification is required before sensitive actions.
- The privacy statement is plain language: activity is private by default.

### Races page

- The official wordmark anchors the shell; the Races title and search action make the page purpose clear.
- Location is broad and user-controlled (`Algeria` in the reference); precise home location is never
  inferred or exposed from this surface.
- One featured race earns the prominent visual treatment; upcoming rows stay compact and scannable.
- Each race opens a detailed route with registration state, category, capacity, price, cutoff, and
  organizer information before the user commits.
- Loading, cached/offline, no-results, and server-error states preserve the last safe navigation path.

### Account page

- The page shows display name and broad location only, then a compact season summary and next entry.
- The stable action order is registrations → profile/preferences → privacy/data → support.
- Privacy is a first-class destination; private activity, precise location, Coach memory, export, and
  deletion are not buried in an unrelated settings menu.
- Registration tickets and certificates are fetched through authorized routes and are not public files.
- Logout and account switching revoke or purge native session/local data according to the security plan.

## Motion and interaction

- Use short 150–250 ms state transitions for pressed, focused, selected, loading, and confirmed states.
- Avoid decorative page-load choreography. Content is visible immediately with skeletons for network
  data and a clear retry affordance for failures.
- Splash handoff, theme changes, locale changes, category selection, and registration success may use
  short crossfades or shared-element transitions where they communicate state.
- Every motion has a reduced-motion alternative; haptics are optional and never the only feedback.
- Android back always follows the visible flow: dismiss keyboard/overlay first, then page navigation,
  preserving form state where safe.

## Modes

The complete native surface supports three modes through the same semantic token set:

| Mode | Primary use | Visual rule |
| --- | --- | --- |
| Light | Discovery, registration, account management, bright outdoor use | Light surface, navy text, teal/green actions, orange as a measured athletic cue. |
| Dark | Evening use and low-light running context | Deep navy surface, high-contrast white text, muted blue-gray secondary text. |
| Race | Race day, achievements, energetic moments | Lime/purple energy accents over a dark base; keep form, privacy, and safety text calm. |

The reference set demonstrates dark launch/auth, light Races, and dark Account. Native acceptance must
check every screen in all three modes, including contrast, focus, disabled, loading, error, empty, and
offline states.

## Languages and RTL

- English, French, and Algerian Darija are equal product locales, not fallback copy.
- Login and registration copy must remain natural and concise in French and Algerian Darija.
- Arabic/Darija uses true RTL layout: title alignment, field labels, progress, chevrons, navigation,
  and primary actions mirror semantically.
- Numeric values, dates, phone numbers, route maps, and brand assets remain readable and are not
  mirrored as images.
- Test with Arabic shaping, French expansion, 1.3× font scale, TalkBack, narrow screens, and the
  keyboard visible on login, registration, and profile forms.

## Canonical ZidRun assets

The source assets are already in the repository and must be reused instead of redrawn:

| Asset | Path | Use |
| --- | --- | --- |
| Light full wordmark | [`public/brand/zidrun-logo.svg`](../../public/brand/zidrun-logo.svg) | Light surfaces and discovery. |
| Dark full wordmark | [`public/brand/zidrun-logo-dark.svg`](../../public/brand/zidrun-logo-dark.svg) | Dark splash/auth/account surfaces. |
| Race full wordmark | [`public/brand/zidrun-logo-race.svg`](../../public/brand/zidrun-logo-race.svg) | Race mode only. |
| Standalone mark | [`public/brand/zidrun-mark.svg`](../../public/brand/zidrun-mark.svg) | Splash, compact shell, avatar/launcher contexts. |
| Raster fallbacks | [`public/brand/zidrun-logo.png`](../../public/brand/zidrun-logo.png), [`public/brand/zidrun-mark.png`](../../public/brand/zidrun-mark.png) | Tooling or platform surfaces that cannot consume SVG. |
| Existing web renderer | [`src/components/layout/racedz-logo.tsx`](../../src/components/layout/racedz-logo.tsx) and [`src/components/layout/zidrun-logo-svg.ts`](../../src/components/layout/zidrun-logo-svg.ts) | Reference for theme-adaptive artwork and proportions. |
| Existing Capacitor splash | [`src/components/layout/native-splash.tsx`](../../src/components/layout/native-splash.tsx) | Behavior reference while native Android replaces the WebView shell. |

## Native Android acceptance

- Compose/Material 3 uses shared `core/design` tokens for logo placement, typography, spacing, color,
  states, themes, RTL, and accessibility; no screen-specific visual fork.
- Authentication uses secure native session storage and server-authoritative `/api/v1` contracts.
- Registration and Account mutations are validated, authorized, idempotent, retry-safe, and auditable.
- No owner identity, local path, debug detail, framework banner, token, private GPS, GPX, payment proof,
  phone number, or health/Coach context is exposed in public UI, logs, analytics, screenshots, or push.
- Every screen has loading/error/empty/offline/expired-session states and is tested through process
  death, account switching, deep links, Android back, safe areas, permissions, and low-end devices.
- Minimum touch target is 44 dp, body text meets WCAG AA in all modes, and icon-only actions have
  TalkBack labels and visible focus.
