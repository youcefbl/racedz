# ZidRun Production Readiness

> **Overall readiness**
>
> `████████░░░░░░░░░░░░░░░░░` **32% — 19 of 60 release gates complete**
>
> **Release status:** 🟠 Code-stable; hold public production launch until the infrastructure, external-service, staging, and store gates below are complete.

**Last updated:** 2026-07-26

**Current release candidate:** local `main` stabilization commit; push and remote CI are still pending

**Owners:** Product/engineering until deployment and store owners are assigned

This file is the single status dashboard for the ZidRun web platform and Android production release. Detailed execution instructions remain in [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md), [docs/AWS_DEPLOYMENT_PLAN.md](./docs/AWS_DEPLOYMENT_PLAN.md), and [docs/MOBILE_ANDROID.md](./docs/MOBILE_ANDROID.md).

## How progress is maintained

- Only checklist rows with a `PR-###` identifier count toward the progress bar.
- Progress is `completed gates / 60`, rounded to the nearest whole percent.
- Mark a gate complete only after its evidence exists and has been verified.
- Every production-related change must update the progress bar, `Last updated`, affected gates, evidence, blockers, and release log in this file.
- Optional features still require an explicit launch decision; they are not silently treated as complete.

## Current verdict

The release branch passes its local code, browser, security-audit, production-build, standalone-smoke, and Android bundle gates. It is not ready for public traffic yet because hosted staging/production environments, durable data and uploads, real email delivery, monitoring, backup recovery, production smoke tests, and Play Store validation have not been completed.

### Hard blockers to public launch

1. Provision isolated staging and production infrastructure with HTTPS and separate databases.
2. Configure durable uploads plus automated database backups and prove a restore.
3. Verify the production email domain and complete register → email → verify → login on staging.
4. Configure production secrets, Sentry/alerts, uptime monitoring, cron jobs, and AI billing limits.
5. Complete staged web acceptance testing before deploying the same release candidate to production.
6. Complete Android signing/App Links, Firebase, physical-device QA, and Play Console internal testing before the mobile launch.

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

## B. Platform deployment, data, and secrets — 0/11

- [ ] **PR-015** Hosting provider, production topology, budget, and accountable infrastructure owner approved.
- [ ] **PR-016** Staging application and HTTPS domain provisioned.
- [ ] **PR-017** Production application and HTTPS domain provisioned.
- [ ] **PR-018** Separate staging and production PostgreSQL databases provisioned and access-restricted.
- [ ] **PR-019** Production environment inventory completed with unique secrets and canonical HTTPS `AUTH_URL`/`NEXTAUTH_URL`.
- [ ] **PR-020** `prisma migrate deploy` procedure exercised on staging and documented for production promotion.
- [ ] **PR-021** Automated production database backups enabled and a restore rehearsal completed.
- [ ] **PR-022** Upload storage made durable through object storage or a backed-up persistent volume; upload/restore tested.
- [ ] **PR-023** Production superadmin bootstrap procedure completed without leaving temporary passwords in the environment.
- [ ] **PR-024** Internal cron endpoints scheduled with production secrets and monitored for failures.
- [ ] **PR-025** Data retention, account deletion/export, privacy policy, and operational access rules reviewed for launch.

## C. External services and observability — 0/8

- [ ] **PR-026** Resend sending domain verified with SPF/DKIM and production delivery tested.
- [ ] **PR-027** OpenAI production key, billing, model access, daily/monthly caps, and failure behavior verified.
- [ ] **PR-028** Sentry production project configured with environment tags, source maps, alerts, and a captured test event.
- [ ] **PR-029** Uptime monitoring configured for the platform and at least one authenticated/API health signal.
- [ ] **PR-030** Centralized application logs and an incident-query workflow available to operators.
- [ ] **PR-031** Multi-instance-safe rate limiting selected or deployment explicitly constrained to one application instance.
- [ ] **PR-032** Google OAuth launch decision recorded; if enabled, production redirect URI and native flow verified.
- [ ] **PR-033** Firebase web/native push launch decision recorded; if enabled, production delivery verified.

## D. Staging, production, and launch validation — 0/10

- [ ] **PR-034** Staging deploy completes from the intended release commit using production-equivalent settings.
- [ ] **PR-035** Staging register → verification email → verify → login journey passes with a new real inbox.
- [ ] **PR-036** Staging race discovery, registration, capacity, payment-status, and cancellation journeys pass.
- [ ] **PR-037** Staging organizer request, approval, race publishing, member invite, and participant export journeys pass.
- [ ] **PR-038** Staging admin user/org/race moderation and audit-log journeys pass.
- [ ] **PR-039** Staging AI coach text, voice transcription, safety, entitlement, and usage-limit journeys pass.
- [ ] **PR-040** Staging mobile web, EN/FR/AR RTL, themes, accessibility, and supported-browser checks pass.
- [ ] **PR-041** Production security-header, TLS, cookie, authorization, upload-abuse, and basic load checks pass.
- [ ] **PR-042** Exact tested release commit promoted to production; migrations and admin bootstrap complete.
- [ ] **PR-043** Production critical-path smoke, monitoring, backup status, and rollback readiness approved.

## E. Android and Play Store — 3/10

- [x] **PR-044** Capacitor shell has the production app id/name and defaults to `https://zidrun.com`.
- [x] **PR-045** Android `bundleRelease` succeeds and produces [app-release.aab](./android/app/build/outputs/bundle/release/app-release.aab).
- [x] **PR-046** Native shell, branded icon/splash resources, deep-link handler, and native plugins compile in release mode.
- [ ] **PR-047** Run a clean production `npm run cap:sync` with no development `CAP_SERVER_URL` override and inspect generated config.
- [ ] **PR-048** Release/Play App Signing SHA-256 fingerprint added to `assetlinks.json` and verified from the hosted domain.
- [ ] **PR-049** Production `google-services.json` installed; native push and Crashlytics verified in a release build.
- [ ] **PR-050** Signed release build passes physical-device QA: auth, deep links, coach, GPS/background tracking, voice, notifications, safe areas, and back navigation.
- [ ] **PR-051** Play Console listing, screenshots, privacy policy, Data Safety, content rating, support details, and account-deletion URL completed.
- [ ] **PR-052** AAB uploaded to the Play internal-testing track and installation/update tested through Google Play.
- [ ] **PR-053** Final version code/name confirmed, release notes approved, and production rollout plan/percentage selected.

## F. Release governance — 2/7

- [x] **PR-054** Detailed staging-to-production deployment checklist exists.
- [x] **PR-055** Production readiness dashboard and update rules established in this file.
- [ ] **PR-056** Stabilization changes reviewed, committed, pushed, and protected by a green remote CI run.
- [ ] **PR-057** Release candidate tagged with an immutable version and changelog.
- [ ] **PR-058** Rollback procedure rehearsed for application, database migration, and Android staged rollout.
- [ ] **PR-059** Incident owner, escalation contacts, service dashboards, and first-response runbook assigned.
- [ ] **PR-060** Product and engineering complete the final documented go/no-go decision.

## Latest verified evidence

| Gate | Result | Verified |
|---|---:|---:|
| `npm audit --audit-level=low` | 0 vulnerabilities | 2026-07-26 |
| `npm run lint` | Passed; 559 UI + 400 coach keys across EN/FR/AR | 2026-07-26 |
| `npm run typecheck` | Passed | 2026-07-26 |
| Focused domain suites | Coach/workout/audio/MFA/registration passed | 2026-07-26 |
| `npm run test:e2e` | 40 passed, 1 intentional live-provider skip | 2026-07-26 |
| Visual suite | 26/26 passed | 2026-07-26 |
| `npm run build` | Passed; standalone artifact prepared | 2026-07-26 |
| `npm run smoke` | 13/13 passed against standalone server | 2026-07-26 |
| `./gradlew bundleRelease` | `BUILD SUCCESSFUL` | 2026-07-26 |

## Launch decisions that must remain explicit

- Payments remain manual for the first release; no payment gateway should be implied in launch copy.
- Local uploads are acceptable only with a persistent, backed-up production volume; otherwise move them behind the existing storage boundary before launch.
- Google login and Firebase push may be deferred, but their UI and launch messaging must match the decision.
- iOS is not part of this release until a Mac/Xcode and Apple distribution track are established.
- Registration resale/bib transfer remains out of scope.

## Release log

| Date | Progress | Change | Evidence |
|---|---:|---|---|
| 2026-07-26 | 32% (19/60) | Created the local stabilization commit. PR-056 remains open until the commit is pushed and remote CI passes. | Local Git history |
| 2026-07-26 | 32% (19/60) | Stabilized dependencies, lint/type checks, Sentry, self-hosted fonts, deterministic E2E/visual tests, CI, public race APIs, production redirects/smoke, and Android release packaging. Created this tracker. | Local gates listed above |
