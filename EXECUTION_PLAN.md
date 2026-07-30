# ZidRun Release Plan

> **The only source of truth for progress, priorities, release gates, and future TODOs.**
> Do not create another backlog, phase plan, audit TODO, or progress file. Supporting documents may
> explain how to test or operate the product, but every open action belongs here.

**Last updated:** 2026-07-30

**Release readiness:** `█████████████░░░░░░░░░░░░` **52% — 31 of 60 gates complete**

**Security hardening overlay:** **0 of 15 P0 security gates complete** — release remains on HOLD until
the applicable gates below have evidence.

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
| 6 | P0 | **Complete the security hardening overlay** (`SEC-001`–`SEC-015`, plus `PR-031`, `PR-041`) | Engineering + owner + external reviewer | Close the privacy, identity, application, API, database, infrastructure, monitoring, recovery, attack-testing, and independent verification gates below. Existing controls count only after they are tested and recorded. |
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

## P0 — security hardening overlay

This is a defense-in-depth plan, not a promise of perfect security. The goal is to minimize owner
exposure, minimize the data ZidRun holds, make unauthorized access difficult, limit blast radius, and
detect and recover from attacks. Use the [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/)
as the application verification baseline, the [OWASP API Security Top 10](https://owasp.org/API-Security/)
for route review, and the [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
and [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
guidance for identity controls.

Do not mark a gate complete from code inspection alone. Each closed gate needs a commit or configuration
change, a test/scan result, and production evidence where the control depends on Cloudflare, Caddy,
PostgreSQL, Docker, backups, or the owner’s accounts.

| Gate | Priority | Hardening outcome | Required evidence / acceptance |
|---|---|---|---|
| `SEC-001` | P0 | **Owner privacy and public metadata lockdown.** Remove owner personal identity, email, phone, home/location clues, local paths, infrastructure names, debug routes, framework/version banners, source maps, verbose error details, and accidental author metadata from public HTML, headers, manifests, emails, APK metadata, Git hosting, analytics, and Sentry. Use role accounts/aliases and a dedicated support/security contact; keep the owner’s personal account out of public-facing records. | Public-site metadata/header/error crawl plus `robots.txt`/sitemap review; inspect public repo/history and deployment artifacts; confirm `x-powered-by`/debug/source-map leakage is absent; owner privacy checklist signed. Do not rely on hiding the admin path as the control. |
| `SEC-002` | P0 | **Data inventory, minimization, and lifecycle.** Classify credentials, identity fields, contact data, payment proofs, health/coach data, precise GPS/GPX, social data, logs, analytics, notifications, and backups. Define purpose, access role, retention, deletion, export, legal hold, and subprocessor/provider handling for every class. Default runner profiles and activity to private unless the user explicitly publishes them. | A maintained field-level inventory in this plan or an approved product/operations reference; privacy-policy alignment; working export/delete/revoke flows; retention jobs tested; no health-memory writes until consent and sports-health gates close. |
| `SEC-003` | P0 | **Authentication and session lockdown.** Require phishing-resistant MFA (passkey/security key) for every owner/admin/superadmin account; TOTP is only an explicitly time-limited fallback. Protect enrollment/recovery, rotate/revoke sessions after password/MFA/role changes, enforce idle and absolute session limits, use Secure/HttpOnly/SameSite cookies, prevent account/email enumeration, harden reset/verification/native handoff tokens, and add breached-password/credential-stuffing defenses. | `npm run test:mfa` plus focused tests for reset, verification, OAuth linking, native handoff, logout, session revocation, callback URLs, enumeration, and brute force; production admin MFA proof; no bootstrap credentials remain. |
| `SEC-004` | P0 | **Authorization and tenant isolation.** Review every page, action, API route, object ID, organization membership, admin function, coach record, support thread, payment proof, run/GPX, group, notification, and export for BOLA/BFLA/IDOR. Enforce deny-by-default server-side checks and narrow selects; never trust role or ownership from client input. | Route/object authorization matrix; negative tests using runner A, runner B, organizer A/B, admin, and superadmin; export/private-media denial tests; audit entries for sensitive admin/member changes. |
| `SEC-005` | P0 | **CSRF, origin, CORS, and browser boundary lockdown.** Add explicit origin/fetch-metadata checks for state-changing browser requests, verify Auth.js CSRF behavior for all credential flows, allow only required origins/methods/headers, and ensure no state-changing GET. Keep CSP nonce-based where practical; retain HSTS, frame denial, nosniff, referrer, permissions, and upload sandbox policies. | Header scanner and browser tests for XSS/clickjacking/CSRF/CORS; production checks through Cloudflare → Caddy → Next; CSP report-only rollout followed by enforced policy with zero unexplained violations. |
| `SEC-006` | P0 | **API abuse and resource controls.** Apply shared edge + application rate limits to login, reset, verification, registration, uploads, coach/AI/audio, search/import, support, reports, social actions, notifications, and exports. Add request-size, field-length, pagination, timeout, concurrency, and per-user/storage quotas. Use one app instance until limits are shared. | Route inventory with limits; Cloudflare rules and 429 evidence; load/abuse tests for credential stuffing, scraping, spam, upload exhaustion, AI cost abuse, race oversell, and slow requests; Redis/edge-backed limiter or documented single-instance boundary. |
| `SEC-007` | P0 | **Input, output, and file safety.** Keep Zod validation and parameterized SQL everywhere; review raw SQL; prevent XSS/HTML/MDX injection, template injection, prompt injection, SSRF through imported URLs, unsafe redirects, CSV formula injection, and log injection. Keep uploads outside executable paths, re-encode images, strip metadata, enforce quotas, and make all private media authenticated/signed and non-cacheable. | ASVS/API-focused code review; SAST/dependency/secret scans; malicious corpus tests for images, URLs, CSV, Markdown, GPX, prompts, and oversized bodies; verify no public payment-proof or precise-location URL. |
| `SEC-008` | P0 | **Database isolation and least privilege.** Put PostgreSQL on a private network with no public 5432; use a dedicated runtime role with only required privileges, separate migration/backup roles, TLS in transit, encrypted volumes, connection limits, safe pool sizing, statement/timeouts, and guarded admin access. Remove sample/demo credentials and rotate all production secrets. | Firewall/security-group output; role grants audit; encrypted-volume/DB TLS proof; migration/backup roles tested; secret inventory and rotation record; no secrets in Git, images, logs, client bundles, or `NEXT_PUBLIC_*`. |
| `SEC-009` | P0 | **Backup, deletion, and recovery protection.** Encrypt database and upload backups, keep immutable/offsite copies with limited access, define RPO/RTO, alert on backup failure, test restore into isolation, and verify deletion/retention behavior across primary DB, uploads, backups, email, Sentry, analytics, AI provider, and push systems. | Restore drill with backup ID, timestamp, operator, duration, row/media checks, and result; documented RPO/RTO; deletion and legal-retention decision; no backup accessible from the public web. |
| `SEC-010` | P0 | **Upload and private-data delivery lockdown.** Keep payment proofs, health-adjacent media, GPX, and any non-public user file behind authorization rather than Caddy’s public static handler; use short-lived signed/authenticated delivery, `Cache-Control: private/no-store` where appropriate, access logging without sensitive content, safe `Content-Disposition`, and separate storage prefixes/buckets. | Direct URL, referrer, cache, range-request, MIME, traversal, and cross-account tests; Cloudflare/Caddy config review; confirm the current public `/uploads/*` exception cannot expose a newly added private scope. |
| `SEC-011` | P0 | **Edge, host, and container lockdown.** Cloudflare should be the only public origin path; restrict origin firewall ports, SSH to keys/approved sources, disable root/password SSH, patch the host and images, run containers as non-root with minimal capabilities/read-only mounts where possible, separate upload volume permissions, and remove unused services/routes. | External port scan; origin-IP bypass test; host/container hardening checklist; patch status; Docker/Caddy config review; rollback tested without restoring insecure defaults. |
| `SEC-012` | P0 | **Supply-chain and release integrity.** Pin and audit dependencies, enable lockfile/dependency/security/secret scanning, protect the main branch and deployment secrets, review Prisma migrations/raw SQL, generate an SBOM, prevent source-map/debug artifact publication, and deploy only an owner-approved immutable commit. | Green `npm audit`, lint, typecheck, tests, build; CI scan logs; SBOM; migration review; branch/CI settings; exact production commit and rollback artifact recorded. |
| `SEC-013` | P0 | **Detection, logging, and incident response.** Centralize structured security events while redacting passwords, tokens, payment images, health text, exact GPS, email/phone, and unnecessary IP/device data. Alert on login failures, reset abuse, MFA changes, privilege changes, exports, private-file denials, rate-limit spikes, DB failures, cost anomalies, and suspicious admin activity. Prepare breach containment, account lock, secret rotation, restore, user notification, and law/regulator escalation runbooks. | Synthetic alerts delivered; log-retention/access review; Sentry scrubbing verified; incident tabletop for account takeover, DB leak, ransomware/backup loss, DDoS, upload abuse, and insider misuse; named incident owner and escalation contacts. |
| `SEC-014` | P0 | **Independent verification and recurring maintenance.** Run an external penetration test or qualified security review against web/API/mobile/host boundaries, remediate critical/high findings, and repeat dependency, secret, exposure, backup, access, and authorization reviews on a fixed cadence. | Signed report, severity-based remediation evidence, retest result, quarterly access review, monthly dependency/secret scan, recurring external attack-surface scan, and annual restore/incident exercise. |
| `SEC-015` | P0 | **Execute the controlled attack-test plan before production release and marketing.** Run the repository’s [Security Attack-Test Plan](docs/SECURITY_ATTACK_TEST_PLAN.md) against the exact candidate, using isolated staging for active scans/abuse/load tests and production only for approved passive checks. | The plan’s source/dependency, secret, container, exposure, ZAP, auth/authz, privacy, upload, API-abuse, k6, database, backup, host, Android, and marketing checks are complete; no Critical/High findings remain; Medium findings have approved expiry; sanitized evidence is linked here. |

### Attack coverage required before security sign-off

The acceptance set must explicitly exercise: credential stuffing, phishing-resistant admin takeover,
session theft/fixation/replay, MFA recovery abuse, email/account enumeration, CSRF, XSS, injection and
unsafe SQL, SSRF, malicious redirects, BOLA/IDOR/BFLA, privilege escalation, organization data leakage,
payment/health/GPS exposure, malicious uploads and metadata leakage, scraping/spam, AI prompt and cost
abuse, race-capacity oversell, notification abuse, DDoS/resource exhaustion, dependency/supply-chain
compromise, container/host escape, database compromise, backup theft/ransomware, insider misuse, and
third-party/provider compromise. “No known vulnerability” is not evidence; record the test, result,
remaining risk, owner, and expiry date for every exception.

### Security decisions that are locked for this release

- Phishing-resistant MFA is mandatory for owner/admin/superadmin accounts; TOTP is only a temporary
  fallback with an expiry date and documented exception.
- The database and origin are private; public exposure of PostgreSQL or direct origin access fails release.
- User private data is not served as public static content. Public race imagery is the only default-public
  upload class; every other class needs an explicit privacy decision and access test.
- Precise GPS/GPX, payment proofs, health/coach context, tokens, and credentials never appear in public
  pages, client bundles, analytics, logs, error reports, emails, or backups without access controls.
- Security-through-obscurity is not accepted as a control: hiding owner/admin routes or framework names
  reduces reconnaissance but does not replace authentication, authorization, MFA, rate limiting, or WAF.
- No new data-collecting feature, third-party SDK, public profile surface, or AI memory field ships until
  its data classification, consent, retention, deletion/export, access, and provider-processing decisions
  are recorded here and tested.

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
[docs/MOBILE_ANDROID.md](docs/MOBILE_ANDROID.md), plus the [security attack-test plan](docs/SECURITY_ATTACK_TEST_PLAN.md).
Browser automation does not close a physical-device
gate, and a debug APK does not close a signed-release gate.

### Release decisions that are already locked

- Payments remain manual for this release; do not add a gateway now.
- Registration resale, bib transfer, and a goods marketplace are out of release scope.
- iOS is not part of this release; it needs a Mac/Xcode and a separate distribution track.
- A separate staging deployment is not required. Acceptance must still run against the exact commit
  that is promoted through the owner-approved production-safe process.
- Capacitor remains the current Android release path. The native Android option is isolated and deferred;
  it does not block the current Capacitor release until a later decision gate approves a switch.
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

## P2 — native Android option evaluation

Capacitor remains the release fallback while this option is evaluated. The detailed implementation and
backend contract are in the [Native Android Option Plan](docs/NATIVE_ANDROID_OPTION_PLAN.md). These
workstreams do not change the current 60-gate release baseline and must not introduce breaking API or
database changes for the website or Capacitor app.

| ID | Priority | Workstream | Done when |
|---|---|---|---|
| `NATIVE-001` | P2 | Freeze the Capacitor reference | Exact Capacitor commit, signed artifact, feature/route matrix, native bridge inventory, device results, and known limitations are recorded. |
| `NATIVE-002` | P2 | Create an isolated native Android project | `native-android/` or a separate repository has its own package, Gradle flavors, Firebase app IDs, signing boundary, privacy-safe logging, and no production secret or keystore copied from Capacitor. |
| `NATIVE-003` | P2 | Define additive `/api/v1` contracts | OpenAPI/DTO/error/pagination/rate-limit contracts exist for auth, profile, races, registrations, uploads, runs, coach, notifications, and approved social features; website/server actions remain compatible. |
| `NATIVE-004` | P2 | Implement native auth and device sessions | PKCE/system-browser OAuth, short-lived access tokens, rotating/revocable refresh tokens, MFA, logout-all, account switching, device registration, and session revocation pass security tests. |
| `NATIVE-005` | P2 | Implement native run/offline/media foundations | Foreground GPS service, Room outbox, WorkManager sync, idempotency/conflict rules, GPX/media upload boundaries, recovery, and private storage pass physical-device and privacy tests. |
| `NATIVE-006` | P2 | Reach measured feature and operational parity | Native vertical slice and then agreed feature scope pass Capacitor comparison, API contract, accessibility/RTL, crash/ANR, battery, performance, security, backup, and rollback checks. |
| `NATIVE-007` | P2 | Prove parallel release safety | Separate internal/closed-track package, App Links/Firebase fingerprints, Data Safety/privacy copy, staged rollout, support/monitoring, and Capacitor rollback path are verified. |
| `NATIVE-008` | P2 | Make the switch/continue decision | Weighted comparison is completed with evidence; owner chooses Capacitor, native primary, or both; the decision, migration/retirement plan, and remaining risk are recorded in this file. |

## Current evidence

| Date | Evidence | Result |
|---|---|---|
| 2026-07-30 | Native Android option preservation plan | Capacitor remains the current Android release path. A separate native Android evaluation was defined with isolated project/package rules, additive versioned backend APIs, native auth/device sessions, offline GPS/sync/media requirements, parity tests, and a later owner decision gate (`NATIVE-001`–`NATIVE-008`). |
| 2026-07-30 | `SEC-002`/`SEC-004`/`SEC-005`/`SEC-007`/`SEC-010`/`SEC-011`/`SEC-012`/`SEC-013`/`SEC-015` hardening pass, commits `b61a65f`, `756537e`, `ca65a53`, `68050a3`, `62ab04c`, `11b2424`, `6977cb3`, `8ae7dfd`, plus `ae4951f` for `PR-056`/`PR-057` — all local only, not pushed | **`SEC-004`:** full authorization/IDOR audit across coach, organizer, admin, groups, notifications, and races domains found ownership consistently enforced server-side; the one real gap — `toggleKudos()` (`src/lib/social.ts`) checked `run.isPublic` but not the owner's `profilePrivate`, letting a stale runId be kudoed forever after the owner went private — is fixed, with `scripts/test-social-authz.ts` (`test:social-authz`) as negative-path evidence (6 checks). **`SEC-005`:** CSP `script-src` moved from static `unsafe-inline` to a per-request nonce + `strict-dynamic` (`src/middleware.ts` generates it, `src/app/layout.tsx` reads it via `headers()`); added `applyApiOriginGuard()` — `/api/**` state-changing requests that carry the session cookie now need a matching `Sec-Fetch-Site`/`Origin`, or get a 403. Verified live (curl): nonce differs per request, all 65 script/link tags on a rendered page share it, cross-site+cookie POST is blocked, same-origin+cookie POST passes through. A real regression this introduced — React's known nonce hydration-warning false positive rendering Next's dev-only "1 issue" badge, which failed all 21 visual-regression snapshots — was caught by rerunning the suite, root-caused, and fixed with `suppressHydrationWarning` (commit `ca65a53`); confirmed not a deeper problem by reproducing the exact same failure signature at the pre-session commit `7a4e657` in an isolated worktree with none of this session's changes applied — see the `SEC-012` `test:all` note below for that separate, pre-existing issue. **`SEC-007`/`SEC-010`:** race-registration payment proofs (`paymentProofUrl`, scope `"payment"`) were served by Caddy's public `/uploads/*` handler, unlike coach-payment proofs — fixed by 403'ing `/uploads/payment/*` in Caddy and adding `/api/registrations/[id]/proof` (owner/admin/race's-organizer-only, mirrors the existing coach-payment-proof route); verified with seeded data (owner/organizer-member allowed, unrelated user denied, admin allowed, malformed/traversal paths rejected). Rest of the `SEC-007` review (SSRF, CSV escaping, raw-SQL parameterization, redirect handling) found already safe, no changes needed. **`SEC-002`:** added [docs/DATA_INVENTORY.md](docs/DATA_INVENTORY.md), a field-level classification of every data class (purpose/access/retention/export/processor); surfaced open gaps (no self-service export/delete, a fully dead `medicalCertificateUrl` field, no prune job for expired reset/verification tokens) rather than silently closing them. **`SEC-011`/`SEC-012`/`SEC-015`:** ran dockerized `semgrep --config p/owasp-top-ten` and `trivy fs` (Phase 1) — fixed the Dockerfile running as root (now `USER node`, verified with a real image build) and pinned three GitHub Actions from mutable `@v4` tags to commit SHAs; the only other findings were local-`.env` secrets (confirmed gitignored, never committed) and two accepted false positives (Android's mandatory-exported launcher activity; blog JSON-LD `dangerouslySetInnerHTML` built from developer-authored MDX, not user input). `npm audit` clean (0 vulnerabilities), SBOM regenerated (727 components, same as prior run), all migrations reviewed (no destructive `DROP`s). **Found, not fixed:** `main` has no GitHub branch-protection rule at all (`gh api .../branches/main/protection` → 404) — an explicit `SEC-012` acceptance item, left for the owner since it changes push/merge workflow. **`SEC-013`:** added `src/lib/security-log.ts` (`logSecurityEvent`, redacts password/token/proof/GPS/health-adjacent fields, masks emails) and `src/lib/sentry-scrub.ts` (`beforeSend`/`beforeSendTransaction`, wired into all three real `Sentry.init()` call sites — server/edge/client configs had zero scrubbing before this) — strips cookies/auth headers and redacts request bodies. Wired into login success/failure, MFA enroll/disable, password reset requested/completed, admin role-change/block/unblock/delete, every rate-limit trip (one call site covers ~20+ already-limited routes), the new CSRF guard's blocks, and both payment-proof routes' denials. **`SEC-012` `test:all` caveat:** the full `npm run test:all` gate is green except a **pre-existing, unrelated** issue: running the complete e2e suite together (not any single spec in isolation) fails 12 `visual.e2e.spec.ts` snapshots (home/races pages, every theme) because an earlier-running spec file changes race/registration data that the visual baselines don't account for — confirmed by reproducing the identical failure (down to the pixel counts) on the pre-session commit `7a4e657` in an isolated worktree. Not fixed here (a test-architecture change, out of scope for a security pass); `npm run test:e2e:visual` run alone passes 26/26. **`PR-056`/`PR-057`:** wired up `updateGroup()` (previously dead code — no caller existed) behind an admin-only edit form, added `rotateGroupJoinToken()`, and made `removeGroupMember()` auto-rotate the join token so a kicked member's own copy of the link stops working immediately (previously: leaked/shared links worked forever, and removal had no effect on re-joining). `scripts/test-groups-moderation.ts` (`test:groups-moderation`, wired into `test:all`): 9 checks, including seeding a real join, kicking that member, and proving the exact link they used is dead immediately after. `PR-056`/`PR-057` remain open — nothing was pushed or tagged, and remote CI / mobile acceptance haven't run against these commits. Typecheck, lint, and a full production build pass after every commit above. |
| 2026-07-30 | `SEC-001`/`SEC-003`/`SEC-006` partial code hardening | `next.config.ts` no longer sends `X-Powered-By`. Added session revocation: `User.securityStampAt` (migration `20260730000000_add_security_stamp`) is bumped on password reset, MFA enroll/disable, admin block, and role→ORGANIZER; the Node-side `jwt()` callback (`src/auth.ts`) compares it on every request and `session()` (`src/auth.config.ts`) drops `user` when stale, which the existing `!session?.user` guards (middleware included) then treat as logged out. Verified live with Playwright: a real password-reset via the UI revoked a separate already-open session on its very next request, while unrelated normal sessions stayed authenticated across repeated requests. Added `enforceRateLimit` to ~20 previously-unlimited routes (admin approve/reject/reports, coach goals/nutrition/plans/workouts/runs CRUD + GPX export, notification actions, organizer registrations + CSV export, native Google auth, social feed, `/api/me/registrations`). Typecheck/lint/i18n/build all pass. **Accepted exception, recorded by owner decision:** registration keeps telling the caller "this email already has an account" (`src/app/register/actions.ts`) — a deliberate enumeration/UX tradeoff, not closed for `SEC-003`. This is a code-only slice of `SEC-001`/`SEC-003`/`SEC-006` — none of `SEC-001`–`SEC-015` are closed; DB network isolation, backup/restore drills, Cloudflare/host/container config, MFA production proof, the attack-test plan, and the external pentest remain open and need production/owner/external action. |
| 2026-07-30 | Production passive scan (`SEC-001`/`SEC-005`/`SEC-006`) — full run log in [docs/SECURITY_ATTACK_TEST_PLAN.md](docs/SECURITY_ATTACK_TEST_PLAN.md), "Run log" section | Ran the plan's Phase 2/3 production-sanctioned passive checks (dockerized `testssl.sh` + ZAP `zap-baseline.py`, no active scan/brute force/load) against `https://zidrun.com`. testssl.sh: **A+ (96/100)**, no vulnerable protocol/cipher, valid cert, HSTS with preload. ZAP: 52 PASS, 0 FAIL, 15 WARN, all triaged — one already-known issue (`X-Powered-By`, fix committed, awaiting deploy), a few accepted tradeoffs/scanner false positives, and two new real findings fixed in commit `ba0e5cd` (`racedz-locale` cookie missing `Secure`; Caddy `/uploads/*` missing HSTS). Phase 1 and the active-scan/staging phases (4–6) still need `gitleaks`/`semgrep`/`trivy`/`k6` installed and the isolated staging stack running (`stg.zidrun.com` doesn't resolve yet). |
| 2026-07-30 | Mobile static scan + fixes (`SEC-001`/`SEC-007`/`SEC-010`/`SEC-011`, Phase 7), commit `972ee54` | Ran `apkanalyzer` (manifest) and dockerized MobSF static analysis (`opensecurity/mobile-security-framework-mobsf`) against the current **debug** test build (`zidrun-prod-debug-v2.1.apk`) — findings must be re-verified against the actual signed release candidate. **Fixed:** (1) `com.equimaps.capacitor_background_geolocation.BackgroundGeolocationService` shipped `exported="true"` with no permission guard in the plugin's own manifest (any other app could start/bind it) — overridden to `exported="false"` via a manifest-merger `tools:replace` in `android/app/src/main/AndroidManifest.xml`. (2) `@capgo/capacitor-social-login` hard-depends on the Facebook Login SDK even though the app's code only ever calls it with `provider: "google"` (confirmed via grep — Facebook sign-in is never used); its exported `com.facebook.CustomTabActivity` (a BROWSABLE OAuth-redirect catcher) was removed via `tools:node="remove"`. Both verified with a real `./gradlew :app:assembleDebug` — build succeeds, and the merged manifest / rebuilt APK confirm the overrides took effect; only `MainActivity` (required) and three Google-signature-permission-protected components remain exported. **Verified clean:** no cleartext-traffic misconfig; the `google_api_key`/`google_crash_reporting_api_key` "secrets" MobSF flagged are the standard client-embeddable Firebase Android key (confirm in Google Cloud Console it's restricted by package name + SHA-1, nothing to fix in code); everything else in its "hardcoded secrets" list was password/passkey autofill string localizations (false positives). Separately hand-tested the upload pipeline (`/api/uploads`, local only) with 5 crafted files: a polyglot (valid PNG + appended `<script>` payload) and a real JPEG carrying GPS + camera EXIF were both accepted, then **fetched back and confirmed fully sanitized** — the script payload did not survive re-encoding and the EXIF/GPS was completely stripped; a fake image (HTML content, `.png` name+MIME) and an oversized (6 MB) file were both correctly rejected. This is now tested evidence for `SEC-007`'s upload-safety requirement, not just code inspection. |
| 2026-07-30 | Supply-chain scan + remaining `SEC-006` rate-limit gaps, commit `297a665` | Dockerized `gitleaks detect` over the full git history (180 commits, 5.34 MB): **1 hit, reviewed and dismissed** — the RFC 6238 TOTP test vector constant in `scripts/test-mfa.ts` (a public spec value, not a credential). Generated a CycloneDX 1.6 SBOM via `@cyclonedx/cyclonedx-npm` (727 components; kept out of the repo per the plan's evidence-handling rule, regenerate on demand). Closed the last previously-unlimited API routes: races list/detail/categories (public, IP-keyed), `me/appearance`'s anonymous path (IP-keyed), and the coach-payment-proof file route (session-keyed). Typecheck/lint/build pass. **Found but deliberately NOT changed — needs an owner decision first:** `requireAdmin()` (`src/lib/admin.ts`) has no MFA check, and neither current admin account (`admin@zidrun.com`, `admin@racedz.dz`) has MFA enabled yet. Wiring in the hard enforcement the plan's own locked decision calls for ("phishing-resistant MFA is mandatory for owner/admin/superadmin accounts") would immediately lock both accounts out of `/admin` on deploy. Enable MFA on both admin accounts first (`/account/security`), then this can be closed safely. |
| 2026-07-30 | Security surface review and hardening overlay | Existing controls include CSP/HSTS/security headers, Auth.js JWT sessions, TOTP code paths, image magic-byte validation/re-encoding, private coach-payment routing, audit logs, and process-local rate limits. They are not yet security sign-off evidence. `SEC-001`–`SEC-015` are now defined; **0 of 15** security gates are closed pending controlled attack tests, production configuration proof, recovery evidence, and independent review. |
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
