# Native Android Option Plan

> This document preserves a native Android path while Capacitor remains the current release path.
> It explains the implementation and decision work; open actions and status live only in
> [`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md) under `NATIVE-001`–`NATIVE-008`.

## Decision and guardrails

- Do not switch the current release from Capacitor while the native option is being evaluated.
- Do not rewrite or delete `android/`; it remains the Capacitor project and release fallback.
- Build the native experiment as a separate project at `native-android/` or in a separate repository,
  with a separate Gradle package such as `dz.racedz.native` for internal testing.
- Keep the current production Capacitor package `dz.racedz.app` and its Play listing untouched until a
  later decision gate approves a migration or a second product.
- Share backend domain logic, database schema, privacy rules, security controls, and API contracts;
  never give the native app direct database access.
- Prefer additive backend changes under `/api/v1/*`; do not break the website, Capacitor app, or current
  server actions while the native option is incomplete.
- The native candidate is not a release candidate until it passes the same security, data/privacy,
  physical-device, accessibility, performance, and store checks as Capacitor.

## Native redesign source material

The native app uses the existing Runs and Coach redesign as the visual baseline and extends the same
template to races and account management. These documents and screenshots are the design source of
truth for the native proof and must be reviewed on the same signed device builds as the functional
flows:

- [Runs design flow](runs-design/RUNS_DESIGN_FLOW.md) — overview, create, live run, list, and details.
- [Coach design flow](coach-design/COACH_DESIGN_FLOW.md) — overview, goal setup, weekly plan,
  conversation, and recovery.
- [Race design flow](races-design/RACE_DESIGN_FLOW.md) — race discovery, detail, registration, and
  registrations, with screenshots in [`docs/races-design/images/`](races-design/images/).
- [Account design flow](account-design/ACCOUNT_DESIGN_FLOW.md) — account overview, preferences,
  privacy/data, and the linked registration surface, with screenshots in
  [`docs/account-design/images/`](account-design/images/).
- [Unified native app design flow](native-design/NATIVE_APP_DESIGN_FLOW.md) — splash, login, account
  creation, Races page, and Account page, with the new high-fidelity screenshots in
  [`docs/native-design/images/`](native-design/images/).

The canonical logo and ZidRun artwork remain in [`public/brand/`](../public/brand/): light, dark, and
Race wordmarks, standalone marks, and raster fallbacks. Native implementation must reuse those source
assets and the proportions documented in the [native design flow](native-design/NATIVE_APP_DESIGN_FLOW.md).
Do not copy generated mockup artwork into the product as a replacement for the canonical logo.

The native design acceptance set is three modes (light, dark, race), three locales (English, French,
and Algerian Darija), and Arabic RTL. The screenshots are representative high-fidelity states; the
implementation must verify every screen in every mode and locale, including loading, empty, error,
offline, keyboard, large-text, and permission states. Do not introduce a second native visual system.

## What is being copied

The native app should reproduce the user-visible behavior of the current Capacitor app, not copy its
WebView implementation. Start with a route/feature inventory from the exact Capacitor release candidate:

| Area | Current behavior to preserve | Native implementation target |
|---|---|---|
| Authentication | Credentials, email verification, Google system-browser handoff, MFA, logout, account switching | Native Login/Create Account screens from the [unified native design flow](native-design/NATIVE_APP_DESIGN_FLOW.md); OAuth 2.0/OIDC authorization-code + PKCE in the system browser; secure token storage; explicit session/device management |
| Discovery | Home, races, filters, pagination, race detail, registration | Compose screens backed by versioned JSON APIs, loading/error/empty/offline states, deep links; follow the [unified Races page](native-design/NATIVE_APP_DESIGN_FLOW.md) and the detailed [Race design flow](races-design/RACE_DESIGN_FLOW.md) |
| Registration | Category selection, runner details, payment proof, capacity, duplicate/oversell protections | Idempotent registration API, private upload flow, retry-safe UI, server-authoritative status; follow the Race Registration reference |
| Account | Profile, appearance, language, privacy, notifications, support | Native Account page and settings from the [unified native design flow](native-design/NATIVE_APP_DESIGN_FLOW.md), with detailed [Account design flow](account-design/ACCOUNT_DESIGN_FLOW.md); no sensitive data in local logs or screenshots |
| Runs | Manual/GPS run, pause/resume, background recording, recovery, route, stats, GPX import/export | Foreground location service, lifecycle-safe recorder, Room local store, WorkManager sync, bounded route storage |
| Coach | Plans, workouts, interactions, safety, audio/TTS, memory controls | Native coach surfaces; same server safety/domain rules; controlled offline behavior; no health memory expansion without governance |
| Social/groups | Feed, follows, kudos, groups, moderation/privacy | Add only after API authorization and privacy parity; native notifications and deep links |
| Notifications | FCM registration, preferences, in-app history, tap routing | FCM token lifecycle, notification channels, account isolation, signed/allowlisted destinations |
| Organizer/admin | Existing web dashboards and moderation | Keep web-first initially. Native organizer/admin requires a separate scope, threat model, and approval |
| Themes/languages | Light/dark/race themes, EN/FR/AR, RTL | Compose theme tokens, Arabic RTL layout, font/readability/accessibility parity |

The first native proof should be a vertical slice: sign in → browse races → view a race → register in
staging → receive a notification → record a short offline-capable run → sync it. Do not start by
rebuilding every screen.

## Project structure and copy strategy

### Stage 1 — freeze the Capacitor baseline

1. Record the Capacitor commit, APK/AAB version, package, API behavior, screenshots, device matrix, and
   known limitations in `EXECUTION_PLAN.md`.
2. Export a feature matrix with expected states for online, offline, denied permission, expired session,
   slow network, backgrounded app, force-stop, low storage, and account switch.
3. Capture the existing native bridge contracts from `src/lib/native/*`, Android Java plugins, manifest,
   Firebase configuration, app links, TTS, background location, GPX, and crash recovery.
4. Freeze the backend contract used by the Capacitor build before adding native-only behavior.

### Stage 2 — create an isolated native project

Create a new Android Studio project under `native-android/` with:

- Kotlin, Jetpack Compose, Material 3, Navigation Compose, ViewModel, coroutines, and lifecycle-aware
  state;
- Retrofit/OkHttp plus Kotlin serialization for network calls;
- Room for encrypted/minimized local run state and an outbox;
- WorkManager for retryable background sync;
- foreground service/location APIs for active GPS recording;
- Android Keystore-backed credential/token storage;
- FCM, Android Sharesheet/file picker, App Links, Custom Tabs, TTS, haptics, and Crashlytics only when
  each is justified and covered by privacy/store documentation;
- separate debug, internal, and release flavors with separate application IDs and Firebase app IDs;
- no copied `.env`, production keystore, `google-services.json`, uploaded user files, or tokens in Git.

Keep the native project boundary explicit:

```text
native-android/
  app/
  core/network/       # API client, auth interceptors, error envelope
  core/auth/          # PKCE, token lifecycle, logout/revoke
  core/database/      # Room entities, encrypted local outbox
  core/design/        # shared redesign tokens, canonical logo assets, themes, typography, RTL, states
  feature/auth/
  feature/races/
  feature/registration/
  feature/runs/
  feature/coach/
  feature/notifications/
```

The native app may share generated API models or a small contract package, but it must not import
Next.js, React, Prisma, server-only modules, or web secrets.

### Stage 3 — implement the vertical slice

Build in this order:

1. app shell, environment selection, secure logging policy, navigation, theme, locale, and crash
   breadcrumbs;
2. API client, request IDs, typed errors, timeout/retry policy, TLS-only production base URL, and
   auth/session storage;
3. splash handoff, credentials + browser OAuth/PKCE + account creation, email verification, and MFA
   behavior, matching the [unified native design flow](native-design/NATIVE_APP_DESIGN_FLOW.md);
4. races list/detail with pagination and offline-safe cached reads, matching the Race design flow;
5. registration with idempotency and private payment-proof upload, matching its three-step reference;
6. FCM token registration, notification preferences, and safe tap routing;
7. run recording with foreground service, local persistence, recovery, sync, GPX import/export, and
   background/force-stop tests;
8. account/profile/privacy controls and Coach surfaces, using the Account and Coach design flows;
9. remaining social/group features only after the data contract and authorization tests pass.

At each stage, compare native behavior against the frozen Capacitor reference on the same device and
backend commit. A feature is not “parity complete” because its happy path works once.

## Backend changes required

The current web app uses server actions and cookie/JWT web sessions. A native app needs a deliberate,
versioned mobile contract. These changes should be additive and use existing domain helpers so business
rules do not diverge.

### 1. Versioned mobile API facade

Create `/api/v1/*` route handlers for native-required operations. Start with:

- `auth`: login, OAuth/PKCE completion, refresh, logout/revoke, MFA challenge, email verification state;
- `me`: profile, appearance, language, privacy, notification preferences, export/delete status;
- `races`: list/filter/detail/categories;
- `registrations`: create/status/cancel where allowed, with capacity and payment state;
- `uploads`: presigned/private upload initiation and completion, with scope authorization;
- `runs`: create/update/delete/list/detail, GPX import/export, sync cursor, conflict response;
- `coach`: plans, workouts, interactions, sleep/nutrition/memory controls under existing safety rules;
- `notifications`: device registration, preferences, read state, safe deep-link payloads;
- `social/groups`: only after object-level authorization and privacy tests are complete.

Every endpoint must have a Zod or equivalent contract, explicit response DTO, pagination, maximum
page/body size, consistent error envelope, request/correlation ID, authorization check, rate limit,
audit behavior where sensitive, and OpenAPI documentation. Do not expose Prisma rows directly.

### 2. Native authentication and device sessions

Do not make the native app depend permanently on browser cookies or the current one-time bridge.
Introduce a native session model with:

- authorization-code + PKCE for Google/system-browser sign-in;
- short-lived access tokens and rotating, revocable refresh tokens;
- device/session records with last-used time, platform, app version, and revocation state;
- refresh-token reuse detection and family revocation;
- explicit logout-all-devices and password/MFA/role-change revocation;
- secure error behavior that does not enumerate accounts;
- server-side authorization on every object and organization boundary;
- no access or refresh token in URLs, logs, analytics, push payloads, screenshots, or clipboard.

The current Auth.js web flow remains for the website and Capacitor compatibility during evaluation.
Implement native auth behind a feature flag and test both clients before changing any shared behavior.

### 3. Offline run and sync contract

Running is the strongest reason to choose native, so define this before a large UI rewrite:

- client-generated idempotency key per logical run and per mutation;
- immutable run event or revision ID, server revision, updated-at, and tombstone/deletion state;
- resumable chunk or bounded payload upload for routes and media;
- sync endpoint returning accepted, rejected, conflict, and retryable items;
- server-authoritative distance/time/route validation and duplicate detection;
- safe conflict policy: never silently overwrite a newer server record;
- local encryption, bounded storage, explicit delete/export behavior, and logout purge;
- no background sync of health text or private media without the user’s consent and access policy.

All sync operations must be retry-safe under airplane mode, process death, clock skew, duplicate taps,
expired sessions, and partial network failure.

### 4. Uploads and private media

Replace any assumption that the native app can read public static paths for private files with:

- an authenticated upload-init endpoint returning a short-lived signed target or upload session;
- server-side scope, ownership, MIME, size, checksum, and quota checks;
- malware/content validation and image re-encoding at the storage boundary;
- authenticated or short-lived signed downloads with private/no-store behavior;
- no payment proof, GPX, health-adjacent media, or precise location in public URLs or push payloads.

### 5. Push and app-link contract

- Store device token, platform, app package, app version, locale, and notification capabilities with
  ownership and revocation checks.
- Make registration idempotent and delete/revoke tokens on logout, account switch, uninstall signals,
  invalid-token responses, and account deletion.
- Allow only signed/allowlisted route intents in push `data.href`; never accept an arbitrary URL.
- Add both Capacitor and native package fingerprints to App Links only during the parallel period.
- Use separate Firebase app registrations for debug, internal, and production native variants.

### 6. App version and feature compatibility

Add a lightweight public-compatible app-config endpoint returning minimum supported version, recommended
version, API version, feature flags, maintenance state, and migration requirements. The backend must
reject unsupported destructive sync behavior safely and provide a user-visible upgrade path.

### 7. Observability and privacy

Add platform/app-version/client-build fields to request logs and crash events, but redact credentials,
tokens, email/phone, health text, payment data, and precise GPS. Track native API error rate, refresh
failures, sync backlog, duplicate/idempotency rejects, notification delivery, crash-free sessions,
ANR, battery impact, and offline recovery without turning telemetry into a location tracker.

## Shared backend/domain work versus native-only work

### Must be shared

- Zod/domain validation and business rules;
- capacity, registration, payment-state, cancellation, role, organization, and audit behavior;
- coach safety, privacy, consent, retention, deletion, export, and provider boundaries;
- upload authorization and storage policy;
- notification preference and delivery semantics;
- security headers, rate limits, abuse controls, incident logging, and backups;
- API contract tests and deterministic fixtures.

### Must remain native-only

- Compose UI and navigation;
- Android lifecycle, foreground location service, WorkManager, Room outbox, TTS, haptics, file picker,
  deep links, notification channels, and native crash/ANR integration;
- Android permission prompts, battery optimization education, OS back handling, safe-area behavior, and
  device-specific compatibility.

Do not duplicate business rules in Kotlin merely to make the native UI convenient. If a rule is important
for security, payment, capacity, privacy, or health safety, the backend remains authoritative.

## Verification plan

The native option must pass the same flows as Capacitor plus native-specific checks:

- auth: credentials, PKCE/OAuth, verification, MFA, refresh rotation, revoke, logout, account switch;
- API: contract/schema, pagination, timeout/retry, 401/403/409/429/5xx behavior, request IDs;
- privacy/security: storage inspection, token leakage, screenshots, logcat, exported files, deep links,
  notification intents, root/debug build separation, certificate pinning decision, and object isolation;
- runs: stationary start, background GPS, pause/resume, force-stop, reboot, Doze, permission changes,
  offline recording, duplicate sync, conflict, low storage, route size, GPX import/export;
- product parity: the [unified native design flow](native-design/NATIVE_APP_DESIGN_FLOW.md), detailed
  [Race design flow](races-design/RACE_DESIGN_FLOW.md), detailed [Account design flow](account-design/ACCOUNT_DESIGN_FLOW.md),
  Runs, Coach, notifications, languages, RTL, themes, accessibility, loading/error/empty/offline
  states, and safe back navigation;
- operations: crash/ANR reporting, staged rollout, remote kill switch/feature flag, API compatibility,
  backup/restore, rollback, and account deletion;
- performance: cold start, memory, battery, WebView-free rendering, GPS drain, sync cost, and low-end
  Android devices.

Use the existing Capacitor acceptance matrix in [`docs/MOBILE_ANDROID.md`](MOBILE_ANDROID.md) as the
comparison baseline and the security procedure in [`docs/SECURITY_ATTACK_TEST_PLAN.md`](SECURITY_ATTACK_TEST_PLAN.md)
for attack/privacy checks.

## Decision gate: native or Capacitor

Do not decide from preference alone. Run both builds against the same backend, devices, scenarios, and
release constraints. Score each from 1 (poor) to 5 (excellent), with evidence:

| Criterion | Weight | Capacitor evidence | Native evidence |
|---|---:|---|---|
| GPS correctness, background reliability, recovery | 25% |  |  |
| Offline behavior and sync reliability | 15% |  |  |
| Crash/ANR, memory, battery, cold start | 15% |  |  |
| Feature parity and delivery speed | 15% |  |  |
| Security/privacy/store compliance | 15% |  |  |
| API/backend complexity and operating cost | 10% |  |  |
| Maintainability and team capability | 5% |  |  |

Decision rules:

- Keep Capacitor if it meets the release SLOs, native bridge fixes are bounded, and native parity would
  delay the web/Android launch materially.
- Continue native development if it provides a material, measured improvement in GPS/offline/performance
  or security that justifies the duplicated UI and API work.
- Switch only after native has a signed internal build, production API compatibility, migration/rollback
  plan, separate security evidence, crash/ANR baseline, privacy/store review, and a staged user rollout.
- Keep Capacitor as a fallback until the native build has survived the agreed staged period and rollback
  window.

## Exit and migration options

The final decision must choose one explicitly:

1. **Capacitor continues:** archive the native experiment, keep any additive `/api/v1` work only if it is
   useful to other clients, remove unused native credentials and app registrations, and retain the
   Capacitor release/runbooks.
2. **Native becomes primary:** publish the native package through an internal/closed/staged track first,
   preserve the Capacitor package for rollback, migrate App Links and Firebase deliberately, communicate
   the app update path, and retire Capacitor only after telemetry and support evidence are healthy.
3. **Both continue:** treat them as two supported clients with shared API/version/security contracts,
   separate release artifacts, support matrices, crash dashboards, and explicit maintenance ownership.

No option may silently change the database, privacy policy, authentication semantics, package identity,
or user-facing data retention rules.
