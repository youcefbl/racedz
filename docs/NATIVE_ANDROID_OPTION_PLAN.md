# Native Android Option Plan

> This document preserves a native Android path while Capacitor remains the current release path.
> It explains the implementation and decision work; open actions and status live only in
> [`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md) under `NATIVE-001`–`NATIVE-008`.

## Decision and guardrails

- Do not switch the current release from Capacitor while the native option is being evaluated.
- Do not rewrite or delete `android/`; it remains the Capacitor project and release fallback.
- Build the native experiment as a separate project at `native-android/` or in a separate repository,
  with a separate Gradle package such as `dz.racedz.nativeapp` for internal testing (`native` alone is
  a reserved Java keyword and is rejected as an Android namespace segment).
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

**As built (phases 1–5).** Everything above exists except `core/database/`, `feature/runs/`,
`feature/coach/`, and `feature/notifications/`, which belong to phase 6 and are deliberately absent
rather than stubbed — an empty Room module would imply an offline story that does not exist yet.
Two decisions worth knowing before extending it:

- **No DI framework.** The graph is a handful of singletons wired by hand in
  `app/AppContainer.kt`. `SessionManager` is created before the OkHttp client and injected as the
  token provider through a small indirection, because the client needs the provider and the manager
  needs the API the client builds. Adding Hilt later is possible; it is not needed at this size and
  annotation processing is a real build-time cost.
- **Repositories currently live in `core/auth/Repositories.kt`.** Races, account, and registration
  repositories sit there because they are thin wrappers over `ApiClient` and all need
  `SessionManager` to react to an expired session. If a `core/data` module is added for phase 6,
  move them; do not duplicate them.

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

**Progress.** Steps 1–5 are implemented and verified on an emulator against a local backend; steps
6–9 (FCM, run recording, Coach, social) are not started. The full evidence — including the eight
defects the emulator pass found and how each was fixed — is recorded in
[`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md) under "Current evidence", not duplicated here.

### Remaining phases

Phases 1–5 shipped on 2026-07-31 (project structure and branding; auth; races; account;
registration), followed by a design-fidelity pass over the four screens that have mockups.

`/api/v1` is deployed to production as of 2026-07-31 and verified: `config` and `races` return real
data, `me` is correctly unauthenticated without a token, and an unknown filter answers 422 rather
than 500. A production-wired internal APK exists and reads production's own feature flags. That
unblocks everything below.

Still outstanding from phases 2–5 before those can be called done, not just working:

- OpenAPI documentation for the shipped endpoints — `NATIVE-003` names it and the contract is
  currently pinned only by `scripts/test-mobile-api.ts`.
- Account switching. Only single-account sign-in exists; `NATIVE-004` requires switching.
- A physical-device pass: TalkBack, large-text, small screens, and the real photo picker.
- An independent security review of the token/PKCE design before it guards production sessions.
- A signed-in pass against production. Nobody has yet signed into the production APK, so the whole
  authenticated half — refresh rotation, registration, uploads — is verified only against a local
  backend and a seeded database.
- Two open design questions the mockups do not settle: whether there is a fifth "Home" tab
  (`04-races-page.png` and `01-races-overview.png` show one, `05-account-page.png` and
  `02-race-details.png` do not, and no Home screen is designed), and whether the "Open ticket"
  action on the Account hub implies a ticket/bib screen that does not exist.

#### Phase 6 — notifications (step 6)

FCM token registration tied to a device session, notification preferences, in-app history, and tap
routing. Two constraints already written into this plan: `data.href` must be a signed or allowlisted
destination and never an arbitrary URL, and tokens must be revoked on logout, account switch, and
account deletion. Needs a separate Firebase app registration per variant — the production
`google-services.json` must not be copied here.

#### Phase 7 — runs (step 7) — **partly done**

Shipped: the `/api/v1/runs` sync contract (clientId idempotency, server revisions, tombstones,
bounded routes), the foreground location service with the website's own GPS acceptance rules ported
1:1, the recording and summary screens, run history, and run detail with splits and elevation.

The durable outbox now exists: a recording is written to app-private storage from its first fix
(rate-limited to every 15s, forced on pause and finish), a failed save never clears it, and a
finished run left behind by a killed process is restored on the next launch and taken straight to
the summary. It is a JSON file rather than Room — a single pending record with no queries, no
relations, and no migrations does not justify the annotation processor this project has otherwise
avoided — and it sits behind a small interface so Room can replace the storage without touching
callers. Revisit that if the outbox ever needs to hold many runs or be queried.

**Still missing:** WorkManager background retry (today a retry needs the app opened), GPX
import/export, manual entry, and reboot/Doze recovery of an *in-progress* recording — only a
finished run is restored, because an interrupted GPS stream cannot be resumed honestly.

GPS distance accumulation has never been verified. The Android emulator reports `speed = 0` on every
fix through both `geo fix` and NMEA, so the (correct) speed filter rejects everything and no
simulated run accumulates a metre. This needs a physical device, and it is the single highest-value
outstanding test — GPS correctness and offline reliability carry 40% of the
[decision gate](#decision-gate-native-or-capacitor) weighting.

#### Phase 8 — coach (step 8) — **UI done, unverified**

All five Coach mockups are built against `/api/v1/coach{,/goals,/plan,/interactions,/sleep}`, each
reusing the website's own helpers so no AI behaviour lives in the mobile facade. Two-stage onboarding
(profile, then goal) is enforced server-side.

Not verified on a device, and three gaps remain: the plan's "Log this run" does not pass `workoutId`
to the recorder, "Move"/"I can't today" are not built, and voice input and TTS playback of replies
are not wired.

#### Phase 9 — social and groups (step 9)

Feed, follows, kudos, and groups — only after object-level authorization and privacy tests pass.
Deliberately last: it is the area where a mistake exposes one runner's data to another.

#### Then: release safety and the decision (`NATIVE-006`–`NATIVE-008`)

Parity measurement against the frozen Capacitor build on the same devices, a signed internal-track
release with its own keystore, App Links and Firebase fingerprints, Data Safety copy, staged
rollout, crash/ANR and battery baselines, and finally the weighted comparison that picks Capacitor,
native, or both. None of this starts before phase 7 has real numbers.

### Build variants

| Variant | Application ID | API base URL | Signing | Purpose |
|---|---|---|---|---|
| `debug` | `dz.racedz.nativeapp.debug` | `http://10.0.2.2:3003/` | debug key | Emulator against `npm run dev` |
| `internal` | `dz.racedz.nativeapp.internal` | `https://zidrun.com/` | debug key | Physical-device testing against production |
| `release` | `dz.racedz.nativeapp` | `https://zidrun.com/` | unsigned | Placeholder; needs a real keystore before it means anything |

Running against a local backend: `npm run dev`, then `./gradlew :app:installDebug`. Only the `debug`
variant permits cleartext, and only to `10.0.2.2` — the override lives in `app/src/debug/res/xml/`,
so no build that can reach production is able to fall back to plaintext.

`./gradlew :app:assembleInternal` produces the physical-device test APK. Three things about it are
deliberate and should not be "fixed" without thinking:

- **It is signed with the debug keystore.** This plan forbids copying the production keystore into
  the project, and the artifact must not be mistakable for something publishable — it cannot be
  uploaded to Play and cannot be upgraded to a real release.
- **`isDebuggable = false`.** It talks to real user data. A debuggable process can be attached to
  over adb and have its memory and its `EncryptedSharedPreferences` read.
- **Its own application ID.** It installs alongside the production Capacitor app
  (`dz.racedz.app`) and the emulator debug build rather than replacing either.

`/api/v1/*` went live on production on 2026-07-31, so the internal APK is now usable end to end.
(Before that it reached `https://zidrun.com` over TLS and got 404 on every screen — a backend gap,
not a client fault.)

### APK versioning — required

**Every APK handed to anyone gets a new version. No exceptions, and no reusing a number that has
already left this machine.**

Two builds sharing a version cannot be told apart. Android also refuses to install over an equal or
lower `versionCode`, so a tester silently keeps the old build and reports bugs against code that is
no longer current — which wastes far more time than the bump costs. This already happened once here:
two different native builds were handed over as "v0.2" and "v0.3" while both declared `0.2.0`
internally.

Before each build, raise **both** fields in `native-android/app/build.gradle.kts`:

- `versionCode` — a plain increasing integer. This is the one Android enforces.
- `versionName` — the human version, e.g. `0.4.0`. The APK filename is derived from it.

Then build with the helper, which reads the version back **out of the finished APK** rather than
taking it on trust, so the filename can never disagree with the manifest:

```bash
cd native-android
./release-apk.sh            # production build → ~/Downloads/zidrun-native-internal-v<version>.apk
./release-apk.sh debug      # emulator build   → ~/Downloads/zidrun-native-debug-v<version>.apk
```

It refuses to overwrite an existing file, so forgetting the bump fails loudly instead of quietly
producing a second, different "v0.4".

Native APKs version independently of the Capacitor app's `zidrun-prod-debug-v<X.Y>.apk` series —
they are different applications with different application IDs, and a shared numbering would imply
a relationship that does not exist.

| Version | Date | What changed |
|---|---|---|
| `0.5.0` | 2026-07-31 | Runs UI aligned with the mockups (footprint ring, guided/free choice, audio cues, run detail charts); Coach tab and coach onboarding |
| `0.4.0` | 2026-07-31 | Design-fidelity pass over Races, Race detail, Account, and Auth; first build against the deployed production API |
| `0.2.0` | 2026-07-31 | First production-wired build (shipped twice, as "v0.2" and "v0.3" — the mistake this section exists to prevent) |

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

**As built.** `src/lib/api/v1/` holds the shared pieces — `http.ts` (envelope, typed `ApiErrorCode`
union, bounded body reader, pagination capped at 50), `tokens.ts` (access/refresh lifecycle),
`guard.ts` (`requireMobileUser`), `dto.ts` (every response shape, listed field by field), and
`idempotency.ts`. Live routes cover `auth`, `me`, `races`, `registrations`, `uploads` (as the
registration payment-proof route), and `config`; `runs`, `coach`, `notifications`, and
`social/groups` are **not** implemented and must not be added without the authorization and privacy
tests this plan already requires. OpenAPI documentation is still outstanding — the contract is
currently pinned by `scripts/test-mobile-api.ts` (`npm run test:mobile-api`, 44 assertions against a
live server) rather than by a published schema.

Two rules the DTO layer encodes, worth restating because they are easy to undo:

- **Organizer bank details** (`baridiMobNumber`, `ccpAccount`, `ccpKey`) appear only on a
  registration the caller owns — never on race list or race detail, where they would be public.
- **Payment proofs** are exposed as a boolean (`hasPaymentProof`), never as a storage path. The
  image is reachable only through `/api/v1/registrations/:id/payment-proof`, which re-checks
  ownership on every read and answers 404 (not 403) for someone else's registration, so the
  endpoint cannot be used to enumerate registration ids.

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

**As built.** Access tokens are 15-minute HS256 JWTs signed with `AUTH_SECRET`; refresh tokens are
opaque 256-bit values persisted only as SHA-256 hashes in `MobileSession`, rotated on every use and
grouped by `familyId`. Presenting an already-rotated token revokes the entire family and logs
`mobile_refresh_reuse_detected`. Every authenticated call re-reads the live `User` row and compares
`securityStampAt`, so the existing web revocation mechanism (password reset, MFA change, block, role
change) logs mobile devices out within the access token's lifetime rather than at its expiry —
verified on device.

Google sign-in is authorization-code + PKCE through a Custom Tab, deliberately **not** a WebView and
deliberately **not** a second copy of the Google integration: `/api/v1/auth/authorize` redirects to
the website's own `/login`, so Google, blocked accounts, rate limits, and the MFA page all apply
unchanged, and only the resulting single-use code comes back over `zidrun://auth/callback`. Two
consequences to preserve if this is ever refactored:

- The redirect target is allowlisted server-side. A custom scheme can be claimed by any installed
  app, so the code is bound to a PKCE `S256` challenge whose verifier never leaves the app process —
  an interceptor receives a value it cannot spend.
- The app compares the returned `state` before redeeming. Without that check, any app or web page
  able to fire the deep link could hand the app a code for an account the user did not choose.

Still outstanding for `NATIVE-004`: account switching (only single-account sign-in exists), device
registration for push, and an independent security review of the above.

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

#### Settled contract (drafted 2026-07-31, not yet implemented)

**Blocked on one product decision — see "Open question" below.**

`RunnerRun` already carries the run's substance (distance, duration, pace, route, effort, validity).
Sync needs three columns it does not have:

| Column | Purpose |
|---|---|
| `clientId String?` | Client-generated UUID, unique per `(userId, clientId)`. Both the idempotency key and the stable identity of a run created offline, so a phone that never saw the 201 can retry without creating a second run. |
| `revision Int @default(1)` | Bumped on every server write. The client sends the revision its edit was based on; a mismatch is a conflict, never a silent overwrite. |
| `deletedAt DateTime?` | Tombstone. A delta sync must be able to tell a client that a run it holds was deleted elsewhere — without this, deleting on one device leaves it resurrected on another. |

Plus an index on `(userId, updatedAt)` for the delta cursor.

Endpoints:

- `GET /api/v1/runs?updatedSince=<iso>&limit=` — delta sync. Returns creates, updates, **and**
  tombstones since the cursor, ordered by `updatedAt`. The cursor is the server's `updatedAt`, never
  the device clock, so phone clock skew cannot skip records.
- `POST /api/v1/runs` — create. `clientId` required; a repeat replays the original rather than
  creating a second run.
- `PATCH /api/v1/runs/:id` — update, with `baseRevision` as a precondition. If the server is ahead,
  answer 409 **with the current server record** so the client can reconcile rather than guess.
- `DELETE /api/v1/runs/:id` — soft delete, writing the tombstone.

Route payloads are bounded at the API, not just in the client: an hour of 1 Hz GPS is ~3,600 points,
and nothing stops a buggy client from posting far more. The route is capped by point count and by
encoded size, and a run that exceeds it is rejected with a typed error rather than truncated —
silently dropping half a runner's route is worse than refusing it.

Every write reuses the existing server-side rules (workout matching, `detectNonFootActivity`
validity classification, pace derivation) rather than reimplementing them for mobile.

#### Open question — does recording a run require a coaching goal?

Today it does. Every run-creation path on the website goes through `createRunnerRun()`
(`src/lib/coach/service.ts`), which throws `ACTIVE_GOAL_REQUIRED` when the runner has no active
coaching goal. That is a Coach-era constraint, not a data-model one: `RunnerRun.goalId` is nullable
and its relation optional, so the schema already permits a goal-less run.

This has to be answered before `POST /api/v1/runs` is written, because the native app presents Runs
as a top-level tab beside Coach — implying it works without a Coach subscription. The two options:

1. **Keep the rule.** The native Runs tab requires an active goal and says so. No shared code
   changes, but recording is effectively gated behind Coach.
2. **Relax `createRunnerRun` to accept a goal-less run.** Matches what the tab implies and what the
   schema already allows, but it is a change to a helper the website shares, so it needs its own
   regression pass.

Writing a separate mobile-only creation path is explicitly *not* an option: it would fork the
business rules this plan requires stay server-authoritative and identical across clients.

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
