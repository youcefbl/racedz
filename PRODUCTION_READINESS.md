# ZidRun Production Readiness

> **Overall readiness**
>
> `█████████████░░░░░░░░░░░░` **52% — 31 of 60 release gates complete**
>
> **Release status:** 🟡 Web platform is live in production; the next web release needs controlled acceptance plus storage/backup work. A fresh signed Android 2.0 test APK is ready while Google Play closed testing has 2 days remaining in the 12-tester/14-day requirement.

**Last updated:** 2026-07-27

**Current release candidate:** local `main` with Runs-incident lifecycle hardening; exact commit push,
remote CI, and signed-device validation are still pending

**Owners:** Product/engineering until deployment and store owners are assigned

This file is the single status dashboard for the ZidRun web platform and Android production release. Detailed execution instructions remain in [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md), [docs/AWS_DEPLOYMENT_PLAN.md](./docs/AWS_DEPLOYMENT_PLAN.md), and [docs/MOBILE_ANDROID.md](./docs/MOBILE_ANDROID.md).

## How progress is maintained

- Only checklist rows with a `PR-###` identifier count toward the progress bar.
- Progress is `completed gates / 60`, rounded to the nearest whole percent.
- Mark a gate complete only after its evidence exists and has been verified.
- Every production-related change must update the progress bar, `Last updated`, affected gates, evidence, blockers, and release log in this file.
- Optional features still require an explicit launch decision; they are not silently treated as complete.

## Current verdict

The web platform is already live in production with HTTPS, its production database, working account-verification email, production secrets, Sentry/alerts, uptime monitoring, cron jobs, and OpenAI billing limits. A separate staging environment is not required for this release. The tracker now measures readiness for the next controlled web deployment and the Android production rollout, rather than readiness for the initial web launch.

### Remaining release blockers

1. Configure durable uploads plus automated production database backups and prove a restore on the server.
2. Complete controlled web acceptance testing for the exact next release commit before promoting it to production.
3. Finish the Google Play closed-testing requirement (owner reports 12 testers, day 12/14, 2 days remaining), review feedback, and decide rollout readiness.
4. Verify the Play App Signing certificate in hosted App Links and explicitly confirm native push, Crashlytics, deep links, and critical physical-device journeys before mobile production rollout.
5. Run the deterministic Runs incident matrix on an emulator and signed physical-device build,
   including rapid guidance skipping, crash/cold restore, logout teardown, account switching, and
   sustained-speed auto-pause.

### Confirmed live production capabilities

- Production web application, HTTPS domain, PostgreSQL database, canonical auth URLs, and secrets.
- Account registration, verification email, email-link verification, and login.
- Sentry/error alerts, uptime monitoring, internal cron scheduling, and OpenAI billing/usage limits.
- No separate staging environment is required by the owner for this release process.

## A. Release branch and code quality — 14/14

- [x] **PR-001** Dependency tree audited with `npm audit`; result is 0 known vulnerabilities.
- [x] **PR-002** Next.js, Auth.js, Sentry, MDX, PostCSS, Sharp, and security-sensitive transitive packages updated.
- [x] **PR-003** `npm run lint` passes, including EN/FR/AR i18n parity.
- [x] **PR-004** `npm run typecheck` passes.
- [x] **PR-005** Coach, workout, audio, MFA, and registration-concurrency domain checks pass.
- [x] **PR-006** Full Playwright suite passes: 40 passed and 1 paid live-OpenAI test intentionally skipped.
- [x] **PR-007** Responsive/RTL/theme visual suite passes: 26/26, including 18 reviewed snapshots.
- [x] **PR-008** Optimized Next.js standalone production build succeeds.
- [x] **PR-009** Production standalone smoke suite passes: 13/13.
- [x] **PR-010** E2E commands reset only guarded `_e2e`/`_ci` databases and use deterministic lean seed data.
- [x] **PR-011** CI uses deterministic seed data and runs quality, browser, build, and smoke gates.
- [x] **PR-012** Non-persistent public race mutation placeholders are disabled with HTTP 405.
- [x] **PR-013** Sentry client initialization is migrated to the supported Next.js instrumentation entry point.
- [x] **PR-014** Manrope is self-hosted, removing Google Fonts as a production build dependency.

## B. Platform deployment, data, and secrets — 6/11

- [x] **PR-015** Production hosting topology is active and owner-managed.
- [x] **PR-016** Release-environment decision recorded: a separate staging deployment is not required; controlled acceptance will use the owner's production-safe process.
- [x] **PR-017** Production application, HTTPS domain, and routing are live.
- [x] **PR-018** Production PostgreSQL database is provisioned and in use; backup/restore readiness remains tracked separately.
- [x] **PR-019** Production secrets and canonical HTTPS `AUTH_URL`/`NEXTAUTH_URL` are configured.
- [ ] **PR-020** `prisma migrate deploy` procedure documented and rehearsed for the next production promotion.
- [ ] **PR-021** Automated production database backups enabled and a restore rehearsal completed.
- [ ] **PR-022** Upload storage made durable through object storage or a backed-up persistent volume; upload/restore tested.
- [ ] **PR-023** Production superadmin bootstrap procedure completed without leaving temporary passwords in the environment.
- [x] **PR-024** Internal cron endpoints are scheduled in production with their required secrets and monitoring.
- [ ] **PR-025** Data retention, account deletion/export, privacy policy, and operational access rules reviewed for launch.

## C. External services and observability — 4/8

- [x] **PR-026** Production account-verification email and register → verify → login journey are working (owner-confirmed).
- [x] **PR-027** OpenAI production key, billing, model access, daily/monthly limits, and live provider access are configured.
- [x] **PR-028** Sentry production reporting and alerts are configured.
- [x] **PR-029** Production uptime monitoring is configured.
- [ ] **PR-030** Centralized application logs and an incident-query workflow available to operators.
- [ ] **PR-031** Multi-instance-safe rate limiting selected or deployment explicitly constrained to one application instance.
- [ ] **PR-032** Google OAuth launch decision recorded; if enabled, production redirect URI and native flow verified.
- [ ] **PR-033** Firebase web/native push launch decision recorded; if enabled, production delivery verified.

## D. Controlled acceptance and production validation — 1/10

- [ ] **PR-034** Controlled acceptance plan/window defined for the exact next release commit without requiring a separate staging deployment.
- [x] **PR-035** Production register → verification email → verify → login journey works with real delivery (owner-confirmed; recheck during PR-043).
- [ ] **PR-036** Controlled race discovery, registration, capacity, payment-status, and cancellation acceptance journeys pass.
- [ ] **PR-037** Controlled organizer request, approval, race publishing, member invite, and participant export acceptance journeys pass.
- [ ] **PR-038** Controlled admin user/org/race moderation and audit-log acceptance journeys pass.
- [ ] **PR-039** Controlled AI coach text, voice transcription, safety, entitlement, and usage-limit acceptance journeys pass.
- [ ] **PR-040** Controlled mobile web, EN/FR/AR RTL, themes, accessibility, and supported-browser checks pass.
- [ ] **PR-041** Production security-header, TLS, cookie, authorization, upload-abuse, and basic load checks pass.
- [ ] **PR-042** Exact tested release commit promoted to production; migrations and admin bootstrap complete.
- [ ] **PR-043** Production critical-path smoke, monitoring, backup status, and rollback readiness approved.

## E. Android and Play Store — 4/10

- [x] **PR-044** Capacitor shell has the production app id/name and defaults to `https://zidrun.com`.
- [x] **PR-045** Android `bundleRelease` succeeds and produces [app-release.aab](./android/app/build/outputs/bundle/release/app-release.aab).
- [x] **PR-046** Native shell, branded icon/splash resources, deep-link handler, and native plugins compile in release mode.
- [x] **PR-047** Clean production `npm run cap:sync` completes with no development override; generated and packaged config uses `https://zidrun.com` with cleartext disabled.
- [ ] **PR-048** Play App Signing SHA-256 fingerprint added to `assetlinks.json` and verified from the hosted domain. **Open:** the current hosted fingerprint differs from the local release upload-key fingerprint; use the Play App Signing certificate from Play Console.
- [ ] **PR-049** Production `google-services.json` is installed and included by the release build; native push and Crashlytics still need explicit runtime verification.
- [ ] **PR-050** Signed release build passes documented physical-device QA: auth, deep links, coach, GPS/background tracking, voice, notifications, safe areas, and back navigation. **In progress:** Runs-incident code now has focused pure regression coverage, but rapid Skip, orphan-watcher recovery, logout/account switching, cold restore, and rolling auto-pause still require a signed device run; the wider acceptance list is not yet recorded.
- [ ] **PR-051** Play Console listing, screenshots, privacy policy, Data Safety, content rating, support details, and account-deletion URL audited as complete before rollout.
- [ ] **PR-052** Google Play closed test completes and tester feedback is reviewed. **In progress:** owner reports 12 testers, day 12/14, with 2 days remaining.
- [ ] **PR-053** Final version code/name confirmed, release notes approved, and production rollout plan/percentage selected.

## F. Release governance — 2/7

- [x] **PR-054** Detailed deployment checklist exists; its staging path is explicitly optional under the current owner-approved release process.
- [x] **PR-055** Production readiness dashboard and update rules established in this file.
- [ ] **PR-056** Stabilization changes reviewed, committed, pushed, and protected by a green remote CI run. **In progress:** Runs-incident review fixes and local checks are captured in a dedicated local commit; push and remote CI remain open.
- [ ] **PR-057** Release candidate tagged with an immutable version and changelog.
- [ ] **PR-058** Rollback procedure rehearsed for application, database migration, and Android staged rollout.
- [ ] **PR-059** Incident owner, escalation contacts, service dashboards, and first-response runbook assigned.
- [ ] **PR-060** Product and engineering complete the final documented go/no-go decision.

## Latest verified evidence

| Gate | Result | Verified |
|---|---:|---:|
| Runs incident pure regression suite | Snapshot ownership/migration, cold timing, rolling speed, guidance bounds passed | 2026-07-27 |
| Full local quality/E2E/build after Runs hardening | `test:all`: 41 passed, 1 intentional live-provider skip; production build passed | 2026-07-27 |
| `npm audit --audit-level=low` | 0 vulnerabilities | 2026-07-26 |
| `npm run lint` | Passed; 559 UI + 400 coach keys across EN/FR/AR | 2026-07-26 |
| `npm run typecheck` | Passed | 2026-07-26 |
| Focused domain suites | Coach/workout/audio/MFA/registration passed | 2026-07-26 |
| `npm run test:e2e` | 40 passed, 1 intentional live-provider skip | 2026-07-26 |
| Visual suite | 26/26 passed | 2026-07-26 |
| `npm run build` | Passed; standalone artifact prepared | 2026-07-26 |
| `npm run smoke` | 13/13 passed against standalone server | 2026-07-26 |
| `./gradlew bundleRelease` | `BUILD SUCCESSFUL` | 2026-07-26 |
| `npm run cap:sync` + `./gradlew assembleRelease` | Passed; signed Android 2.0 (`versionCode 11`) APK, 6,255,457 bytes, production URL verified, SHA-256 `3bacd881714a4473358cab888dd1e70bfd8c6cff0a16a108e7b5eab4317d3930` | 2026-07-26 |
| Production web services | HTTPS/database/email/auth/secrets/Sentry/uptime/crons/OpenAI operational | Owner-confirmed 2026-07-26 |
| Android closed test | 12 testers; day 12/14; 2 days remaining | Owner-confirmed 2026-07-26 |
| Android signing/Firebase audit | Release key and `google-services.json` present; App Links fingerprint mismatch remains | 2026-07-26 |

## Launch decisions that must remain explicit

- Payments remain manual for the first release; no payment gateway should be implied in launch copy.
- Local uploads are acceptable only with a persistent, backed-up production volume; otherwise move them behind the existing storage boundary before launch.
- Google login and Firebase push may be deferred, but their UI and launch messaging must match the decision.
- iOS is not part of this release until a Mac/Xcode and Apple distribution track are established.
- Registration resale/bib transfer remains out of scope.

## Release log

| Date | Progress | Change | Evidence |
|---|---:|---|---|
| 2026-07-27 | 52% (31/60) | Hardened the Runs incident fix after review: per-user v2 snapshots, orphan-watcher cleanup, awaited logout teardown, cold-time correction, rolling speed auto-pause, full validity enforcement, and focused regression coverage. PR-050/PR-056 remain open for signed-device QA, push, and remote CI. | Local lint/type/build/domain checks plus `test:run-incident`; incident report |
| 2026-07-26 | 52% (31/60) | Repaired Capacitor 6 sync compatibility with the security-patched `tar` dependency, completed a clean production sync, and produced a fresh signed Android 2.0 APK for physical-device testing. PR-050 remains open until device journeys are recorded. | Clean Capacitor sync, embedded production config inspection, Gradle release build, APK signature/version/checksum verification |
| 2026-07-26 | 50% (30/60) | Corrected the tracker for the already-live production platform, removed staging as a release requirement, recorded operational email/monitoring/cron/AI services, and captured Android closed-test status plus remaining App Links/runtime verification. | Owner confirmation + local Android signing/config audit |
| 2026-07-26 | 32% (19/60) | Created the local stabilization commit. PR-056 remains open until the commit is pushed and remote CI passes. | Local Git history |
| 2026-07-26 | 32% (19/60) | Stabilized dependencies, lint/type checks, Sentry, self-hosted fonts, deterministic E2E/visual tests, CI, public race APIs, production redirects/smoke, and Android release packaging. Created this tracker. | Local gates listed above |
