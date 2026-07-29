# ZidRun Release Plan

> **The only source of truth for progress, priorities, release gates, and future TODOs.**
> Do not create another backlog, phase plan, audit TODO, or progress file. Supporting documents may
> explain how to test or operate the product, but every open action belongs here.

**Last updated:** 2026-07-29

**Release readiness:** `█████████████░░░░░░░░░░░░` **52% — 31 of 60 gates complete**

**Status:** **HOLD** until the P0 release gates below are complete and recorded against one immutable
commit. The web platform is live; this plan governs the next web deployment and Android production
rollout.

## What to do next

Work from top to bottom. Do not start P1/P2 product work while an unblocked P0 item can be closed.

| Order | Priority | Action | Owner | Done when |
|---:|---|---|---|---|
| 1 | P0 | **Freeze the release scope and get a green remote candidate** (`PR-056`, `PR-057`) | Engineering | Groups commit `4f0453a` is included by owner decision. Finish public/private group, join-link, invitation, authorization, privacy, moderation, and mobile acceptance; push every intended commit; pass remote CI; tag the exact candidate. |
| 2 | P0 | **Confirm ZidRun production access in Play Console** (`PR-052`) | Owner | After Elmohassib's production-access decision, create/open ZidRun and inspect its Dashboard/Production page. If Production is unlocked, upload ZidRun without repeating the 12-tester cycle; if ZidRun shows its own production-access gate, start its closed track and follow the exact tester requirement shown by Play Console. In either case, review ZidRun's pre-launch, crash/ANR, and policy reports. |
| 3 | P0 | **Run signed physical-device acceptance on 2026-07-30** (`PR-050`) | Engineering + owner | The exact signed candidate passes auth, deep links/back navigation, safe areas, Groups, voice test, guided warm-up/work/cool-down, background GPS, pause/resume, force-kill restore, logout/account switching, sustained non-foot auto-pause, stationary-start drift, and Google Drive/local GPX import. Record device/OS/build and results in this file. |
| 4 | P0 | **Verify native production integrations after device acceptance** (`PR-048`, `PR-049`) | Owner + engineering | With Codex assistance: hosted `assetlinks.json` contains the Play App Signing SHA-256; production push reaches the signed app; notification taps route correctly; a Crashlytics test event appears. |
| 5 | P0 | **Prove data recovery and private storage** (`PR-020`–`PR-025`) | Operations | Rehearse `prisma migrate deploy`; verify automated database backup and restore; make uploads durable; protect payment/private media; document retention, export, deletion, and production access; remove temporary bootstrap credentials. |
| 6 | P0 | **Complete security and health review** (`PR-031`, `PR-041`) | Engineering + external reviewers | Constrain deployment to one instance or add shared rate limiting; validate headers/TLS/cookies/authz/upload abuse; enforce admin MFA or record an explicit owner risk decision; verify Caddy payment-proof rules; complete external security and sports-health reviews. |
| 7 | P0 | **Run controlled web acceptance** (`PR-034`, `PR-036`–`PR-043`) | Product + engineering | On the exact candidate, pass runner registration, capacity/payment/cancellation, organizer lifecycle, admin moderation, Coach/voice/safety, EN/FR/AR/RTL/themes/accessibility, deployment, production smoke, monitoring, backup, and rollback checks. |
| 8 | P0 | **Finish store and rollout governance** (`PR-051`, `PR-053`, `PR-058`–`PR-060`) | Owner | Listing, screenshots, privacy/Data Safety, deletion URL, version/release notes, staged percentage, rollback procedure, incident owner, escalation contacts, and final go/no-go are approved. |

## Progress by gate group

These counts preserve the existing 60-gate release baseline. A gate moves only when evidence exists;
finishing code alone is not enough for a device, operations, or rollout gate.

| Gate group | Complete | Total | Open gate IDs |
|---|---:|---:|---|
| Code quality and release branch | 14 | 14 | — |
| Platform, data, and secrets | 6 | 11 | `PR-020`–`PR-023`, `PR-025` |
| External services and observability | 4 | 8 | `PR-030`–`PR-033` |
| Controlled acceptance and production | 1 | 10 | `PR-034`, `PR-036`–`PR-043` |
| Android and Play Store | 4 | 10 | `PR-048`–`PR-053` |
| Release governance | 2 | 7 | `PR-056`–`PR-060` |
| **Total** | **31** | **60** | **29 open** |

### Completed baseline

- `PR-001`–`PR-014`: dependency audit, lint/i18n, typecheck, domain tests, Playwright, visual
  regression, production build/smoke, deterministic CI data, disabled placeholder mutations,
  supported Sentry instrumentation, and self-hosted fonts are complete.
- `PR-015`–`PR-019`, `PR-024`: production web hosting, HTTPS, PostgreSQL, secrets/canonical auth,
  and scheduled cron jobs are operational.
- `PR-026`–`PR-029`: verification email, OpenAI billing/limits, Sentry alerts, and uptime monitoring
  are operational.
- `PR-035`: owner confirmed register → email → verify → login in production.
- `PR-044`–`PR-047`: Capacitor production identity, native shell/plugins, release bundle, and clean
  production sync are verified.
- `PR-054`, `PR-055`: release procedure and this maintained dashboard exist.

## P0 acceptance details

### Exact release quality gate

Run against the release candidate:

```bash
npm audit --audit-level=low
npm run lint
npm run typecheck
npm run test:all
npm run build
npm run smoke
```

Then follow [docs/TESTING.md](docs/TESTING.md), [docs/OPERATIONS.md](docs/OPERATIONS.md), and
[docs/MOBILE_ANDROID.md](docs/MOBILE_ANDROID.md). Browser automation does not close a physical-device
gate, and a debug APK does not close a signed-release gate.

### Release decisions that are already locked

- Payments remain manual for this release; do not add a gateway now.
- Registration resale, bib transfer, and a goods marketplace are out of release scope.
- iOS is not part of this release; it needs a Mac/Xcode and a separate distribution track.
- A separate staging deployment is not required. Acceptance must still run against the exact commit
  that is promoted through the owner-approved production-safe process.
- Coach health-memory writes remain disabled until explicit consent, retention, export/deletion, and
  sports-health review are complete.
- Raw GPX routes and other precise location evidence must not be committed.
- Groups commit `4f0453a` is in the Android release scope and must pass the same signed-candidate
  authorization, privacy, moderation, and mobile acceptance as the existing release features.

### Parallel launch preparation (owner/marketing)

These do not change the 60 engineering gates, but they must be ready before the public announcement:

1. Confirm the Coach Zid persona/name/catchphrase with native runners and choose real, synthetic, or
   hybrid presentation with transparent AI disclosure.
2. Claim/complete Instagram, Facebook, and TikTok profiles; prepare the link-in-bio destinations.
3. Onboard enough organizers and real races that launch discovery is not empty.
4. Prepare reviewed store/social screenshots, demo recordings, Week 1–2 content, reusable templates,
   and EN/FR/AR copy.
5. Configure privacy-conscious UTM/activation reporting and assign the launch response/feedback owner.

## P1 — first work after release

Do these only after P0 is closed or when a P0 item is externally blocked.

1. **Bound growing data surfaces:** paginate public races, organizer collections, long run histories,
   and any remaining conversation/feed endpoints; add indexes from measured query patterns.
2. **Complete accessibility and RTL acceptance:** 44 px touch targets, focus visibility, contrast,
   logical spacing, directional-icon mirroring, loading/error/empty states, and EN/FR/AR copy parity.
3. **Coach personalization after governance:** health-memory expiry/reconfirmation, progressive
   profile prompts, opt-in coarse location/timezone, and qualified safety review.
4. **Notifications:** payment-proof review notices, race reminders, delivery/idempotency hardening,
   and final signed-device push routing.
5. **Groups after launch:** add richer discovery and engagement only after the release-scope private/public,
   invitation, authorization, privacy, moderation, notifications, migrations, browser tests, and mobile UX are accepted.
6. **Growth:** shareable run/plan cards, post-trial free allowance, and trial-ending lifecycle nudges.

## P2 — later roadmap

- Public runner profiles, clubs/groups discovery, registered-runner blog comments, and remaining
  EN/FR/AR editorial content.
- Social-post Android/PWA Share Target after the existing admin import flow is stable.
- Strava/wearable/FIT sync after provider registration, consent, deduplication, and import provenance.
- Coach location personalization, travel-to-race advice, adaptive check-ins, and Coach as the primary
  runner home.
- Object storage plus PgBouncer/multiple app replicas and k6 registration-open load testing before a
  high-concurrency race. Do not scale app replicas while rate limits and uploads remain process-local.
- Marketplace and bib transfer only after fraud, organizer approval, refunds, and payment rules have
  a separate approved specification.

## Current evidence

| Date | Evidence | Result |
|---|---|---|
| 2026-07-29 | Owner release decisions and Groups commit `4f0453a` | Groups is included; signed physical-device acceptance is scheduled for 2026-07-30; native app-link/push/Crashlytics verification remains open with engineering assistance. `PR-052` remains open until Elmohassib's production-access decision and ZidRun's resulting Production-page state are verified; Google documentation does not clearly resolve second-app behavior. |
| 2026-07-29 | AI race-post import release hardening | Import stays draft-only, exposes confidence/warnings/all source images, supports category correction, deduplicates source links, and requires an audited human confirmation across every publish path. Migration reset, focused normalization test, publish-guard browser test, lint, typecheck, and production build pass; remote candidate CI remains open. |
| 2026-07-29 | GPX picker/startup-drift hardening, commit `a83e159` | Incident/run-stat tests, lint, typecheck, focused GPX browser test, and production build passed. Raw routes stayed untracked. Push/remote CI and signed-device validation remain open. |
| 2026-07-28 | Pixel 8 debug-emulator incident matrix | Rapid guided skip, force-kill restore, and account switching passed. Sustained-speed auto-pause was inconclusive because Android throttled mock locations. |
| 2026-07-27 | Runs lifecycle/validity hardening | Full local test suite and build passed; suspect activities are excluded; snapshot ownership and guided bounds are covered. |
| 2026-07-26 | Android 2.0 release artifact | Clean production Capacitor sync and signed release build passed. Play App Signing fingerprint and runtime Firebase/Crashlytics verification remain open. |

## Maintenance rules

1. Update the progress line, affected gate, current evidence, and `Last updated` date in this file in
   the same change that affects release status.
2. Never mark owner/external/device work complete from code inspection alone.
3. Remove completed implementation detail; keep one concise evidence row instead of a growing diary.
4. Product reference belongs in `PRODUCT.md`; architecture in `CODEX_CONTEXT.md`; procedures in
   `docs/TESTING.md`, `docs/OPERATIONS.md`, or `docs/MOBILE_ANDROID.md`; incident facts in the incident
   report. None of those files may maintain a separate backlog or percentage.
5. If code and this plan conflict, verify the code, correct this file immediately, and do not create a
   second tracker.
