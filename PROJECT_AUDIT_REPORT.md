# ZidRun Project Audit Report

**Audit date:** 2026-07-13  
**Scope:** Current working tree of ZidRun (`racedz`)  
**Method:** Repository inspection, targeted source searches, static checks, Prisma validation, dependency audit, and available test commands. Existing uncommitted changes were preserved and not evaluated as committed product behavior.

## Executive summary

ZidRun has a credible MVP foundation. Public race discovery, credentials authentication, email verification, Google OAuth, runner registration, organizer workflows, admin workflows, audit logging, uploads, and the AI coach are represented in the implementation. `npm run lint`, `npm run typecheck`, `npm run build`, Prisma validation, coach checks, and workout checks pass.

It is not production-ready yet. The most urgent risks are:

1. Race payment proofs are publicly served and upload ownership is not bound to the uploader or registration.
2. MFA is opt-in and is bypassed by Google/native authentication; admin authorization also trusts stale JWT role claims.
3. Registration capacity is checked and decremented without an atomic database guard, allowing overselling under concurrency.
4. Production dependency scanning reports 3 high and 24 moderate vulnerabilities.
5. There is no CI workflow or reliable runtime smoke result, and several public mutation APIs remain placeholders.

## Scorecard

Scores are engineering assessments based on the current repository, not production metrics.

| Area | Assessment | Notes |
|---|---:|---|
| Core MVP functionality | 7.5/10 | Main journeys exist; public race mutation APIs are incomplete. |
| Security | 5.5/10 | Good validation and baseline authz, but sensitive upload and session/MFA issues are blockers. |
| Data integrity | 6/10 | Transactions and unique constraints exist; capacity concurrency is unsafe. |
| Performance/scalability | 6.5/10 | Several admin queries paginate, but some public/organizer reads are unbounded. |
| Automated quality | 4.5/10 | Static checks pass; focused tests exist, but no CI and limited e2e coverage. |
| UX/i18n/accessibility | 6.5/10 | Mobile-first themes and locale support exist; notification localization and RTL QA are incomplete. |
| Deployment readiness | 5.5/10 | Docker/Caddy/cron direction exists; health checks, CI, shared rate limiting, and durable storage remain. |
| Documentation accuracy | 6/10 | `TODO.md` and context are useful, but some agent notes and plans are stale. |

## Verified current status

### Implemented or substantially implemented

- Public race listing and race detail reads use `src/lib/race-repository.ts` and Prisma with mock fallback behavior.
- Credentials authentication, bcrypt password verification, safe callback validation, email verification, JWT sessions, and role redirects are implemented in `src/auth.ts`, `src/lib/auth-credentials.ts`, and `src/app/login/actions.ts`.
- Google OAuth and the native Google bridge exist in `src/auth.ts` and `src/app/api/auth/native/google/route.ts`.
- Runner registration has validation, event/category checks, duplicate protection, capacity fields, and an authenticated API rate limit in `src/lib/registrations.ts` and `src/app/api/races/[id]/register/route.ts`.
- Organizer onboarding, approved-organization checks, membership, invitations, race/category management, participant management, and edit history exist in `src/lib/organizer.ts` and the organizer routes/actions.
- Admin organization/race approvals, platform race creation, user role management, blocking, audit logs, and race history exist in `src/lib/admin.ts` and `src/app/admin/actions.ts`.
- The AI coach has user-scoped goals, runs, plans, quotas, safety checks, structured model output, and focused checks in `src/lib/coach/`, `src/app/api/coach/`, and `scripts/`.
- Upload validation includes size limits, MIME checks, magic-byte checks, UUID filenames, and scope checks in `src/lib/storage.ts`.
- Cron endpoints use a secret and timing-safe comparison, for example `src/app/api/internal/cron/complete-past-races/route.ts`.
- Admin and organizer list functions include pagination in `src/lib/admin.ts`; CSV export protects against spreadsheet formula injection in `src/app/api/organizer/events/[id]/registrations/export/route.ts`.

### Partial, fragile, or planned

- `POST /api/races`, `PATCH /api/races/[id]`, `DELETE /api/races/[id]`, and category creation return placeholder responses rather than persisting changes: `src/app/api/races/route.ts`, `src/app/api/races/[id]/route.ts`, and `src/app/api/races/[id]/categories/route.ts`.
- MFA has enrollment and verification UI, but it is not required for admins. Google OAuth and the native bridge create sessions without MFA verification: `src/auth.ts`, `src/lib/mfa.ts`, and `src/app/account/security/`.
- `requireAdmin()` relies on the role in the JWT: `src/lib/admin.ts:113-125`. Blocking or demoting a user does not revoke already-issued JWTs.
- The server-action registration path has no equivalent to the API registration rate limit: `src/app/races/[slug]/register/actions.ts`.
- Public race reads and some organizer reads have no explicit pagination: `src/lib/race-repository.ts:153-211` and `src/lib/organizer.ts:177-198,455-489`.
- General notification text is English-only and frequently hardcoded: `src/lib/notifications.ts:47-138` and notification builders later in the same file.
- There is no runner self-service deletion/export flow. `TODO.md` identifies this, while the privacy policy implies stronger account controls than the current UI provides.
- Local uploads remain the default. Durable private object storage, deployment health checks, shared rate limiting, and a CI pipeline are not complete.

## Security findings

### P0 / release blockers

#### SEC-01 — Payment proof confidentiality and ownership are insufficient

Race payment proofs are returned as public `/uploads/payment/...` URLs by `src/lib/storage.ts:75-82`, and `Caddyfile:12-30` publicly serves the general uploads tree. The payment proof action only checks that the URL matches a format and that the registration belongs to the current user: `src/app/account/registrations/actions.ts:9,30-50`.

Coach payment proofs have an authenticated serving route, but attachment validates only the URL pattern in `src/lib/coach/subscription.ts:63-65`; the serving route authorizes against a database URL match in `src/app/api/coach/subscription/proof/[...path]/route.ts:20-36`. There is no durable upload-owner binding.

Impact: a leaked or guessed proof URL can expose banking/identity documents; a user who obtains another user’s coach proof URL may be able to attach it to their own request. Treat payment evidence as private data.

Fix: create an upload record bound to uploader, purpose, and target; use private storage or an authenticated streaming route; authorize both upload ownership and target ownership; stop accepting arbitrary URL strings as proof.

#### SEC-02 — Admin MFA is not enforced and alternate login paths bypass it

MFA is opt-in in `src/app/account/security/`, while `src/lib/admin.ts:113-125` does not require an MFA-enabled session. The Google callback and native bridge in `src/auth.ts` establish sessions without a second-factor check. This leaves privileged accounts dependent on password/OAuth security even though MFA infrastructure exists.

Fix: enforce MFA for admin/superadmin accounts at sign-in and on privileged server-side guards. Ensure credentials, web OAuth, and native token exchange use the same policy. Do not rely only on a client-side MFA screen.

#### SEC-03 — JWT authorization claims can remain valid after role/block changes

`src/auth.ts:129-164` copies role and organization IDs into the JWT, and `requireAdmin()` trusts those claims. `toggleBlockUserAction` changes database state in `src/app/admin/actions.ts:361-388`, but there is no demonstrated session revocation/version check for existing tokens.

Impact: a blocked or demoted user may retain access until the token expires; an organization membership change can also lag behind the token.

Fix: add a session version/revocation timestamp checked by server guards, or refresh authorization from the database for sensitive operations. Apply the check consistently to admin, organizer, API, and server-action paths.

### P1 / high priority

#### SEC-04 — Native Google account linking does not match the web linking safeguard

The web Google path contains a guard around existing password accounts in `src/auth.ts`, but `src/lib/native-auth.ts:39-79` updates an existing user’s email verification state without applying the same password-account linking rule. Keep linking policy identical across web and native authentication.

#### SEC-05 — Dependency audit reports production vulnerabilities

`npm audit --omit=dev` reported **27 vulnerabilities: 3 high and 24 moderate**. The high findings include arbitrary-code-execution risk in `next-mdx-remote@5.0.0` and a path-traversal/file-write issue in `rollup@3.29.5` through the Sentry dependency tree. Remediate, replace, or explicitly isolate affected packages; then commit a reviewed lockfile update and rerun the audit.

#### SEC-06 — In-memory rate limiting does not protect a multi-instance deployment

`src/lib/rate-limit.ts` stores counters in process memory. This is bypassable across ECS tasks and resets on restart. Use a shared Redis/database limiter and/or edge/WAF controls for authentication, registration, uploads, invitations, coach requests, and MFA verification.

#### SEC-07 — Private run photos can be publicly retrievable

Run uploads are stored under `/uploads/run`, while `RunnerRun.isPublic` controls application visibility rather than static-file access. A private run’s image URL can therefore remain directly accessible. Use private object storage or authenticated media delivery for non-public runs.

#### SEC-08 — Recovery-code consumption is not visibly atomic

`src/lib/mfa.ts` reads a matching backup-code hash and then updates the user record. Concurrent requests could race before the code is removed. Consume codes with an atomic conditional update or a transaction/row lock, and add a concurrency test.

## Reliability and data integrity

### DATA-01 — Registration capacity can be oversold

`src/lib/registrations.ts:160-262` checks availability and then decrements `RaceEvent.availablePlaces`, but does not use a row lock or conditional update tied to the remaining capacity. Concurrent registrations can pass the check before either decrement commits.

Fix with an atomic `UPDATE ... WHERE available_places > 0`, inspect affected rows, and keep duplicate/category constraints in the same transaction. Add a concurrent registration test.

### DATA-02 — Notification failure occurs after registration commit

`src/lib/registrations.ts:32-61` creates the registration and then sends notification work outside the transaction. If notification fails, the user can see an error despite a successful registration and retry into a duplicate response.

Fix with an outbox/job table, idempotent notification delivery, and a success response that is not coupled to best-effort notification delivery.

### DATA-03 — Several reads can grow without bounds

`findRaceEvents` does not apply a public result limit, and organizer race/member reads load complete collections. Add bounded pagination, maximum page sizes, and indexes based on actual filters.

## Product, UX, and compliance gaps

- Complete or remove the placeholder public race mutation APIs so API behavior matches the product contract.
- Add a complete registration state model for cancellation/refunds and restore capacity safely; the current domain still has manual payment fields rather than a payment provider.
- Add localized notification templates and a persisted user locale. Current notification builders are predominantly English-only.
- Add runner privacy controls, public-profile rules, data export, and self-service deletion/anonymization. Align the privacy policy with actual behavior.
- Finish RTL and accessibility QA for forms, dashboards, upload states, tables, and the three theme modes.
- Add email delivery for invitations and operational notifications; current invitation behavior is copy-link oriented.
- Review AI-coach health-data handling with a qualified domain reviewer. The coach context can include injuries, chronic conditions, health notes, body metrics, sleep, nutrition, and GPS-derived run information (`src/lib/coach/context.ts:103-173`). `store:false` is used for model requests, but application-side persistence, retention, deletion, and user disclosure need a complete policy.

## Deployment and quality gaps

- No `.github/workflows` CI pipeline was found.
- No full runtime smoke result was available: `npm run smoke` produced 12/12 connection failures because no server was running, and starting the dev server required an elevated operation that was not approved. This is an environment limitation, not proof that every endpoint is broken.
- Add a health/readiness endpoint and run migration, seed, build, smoke, and security checks in CI/staging.
- Replace local upload storage before a multi-instance production deployment; use private S3-compatible storage for payment and private-run assets.
- Keep `package.json`, `package-lock.json`, `AGENTS.md`, `TODO.md`, and `EXECUTION_PLAN.md` synchronized. The agent notes still say there are no automated tests, while Playwright specs and test scripts now exist. The documented middleware location also does not match the active root `middleware.ts`.

## Prioritized remediation plan

### P0 — Before handling real users or payment evidence

1. **Private uploads and ownership binding** — Update `src/lib/storage.ts`, payment actions, coach subscription proof flow, upload routes, schema/migrations, and Caddy/deployment configuration. Acceptance: payment/private-run files return 401/403 without authorization; users cannot attach or read another user’s file; URLs are not public static assets.
2. **Privileged MFA policy** — Update `src/auth.ts`, native auth, `src/lib/admin.ts`, middleware/server guards, and MFA tests. Acceptance: every admin/superadmin login path requires MFA when policy says so; privileged actions reject stale or non-MFA sessions.
3. **Session revocation/authorization freshness** — Add a revocation/version mechanism and apply it to admin and organizer guards. Acceptance: block, demote, or remove a user’s membership and verify existing sessions lose access immediately or within the documented short window.
4. **Dependency remediation** — Resolve the three high findings and review the Sentry/MDX dependency choices. Acceptance: approved `npm audit --omit=dev` result with no unexplained high vulnerabilities.

### P1 — Before meaningful traffic

1. Make capacity decrement atomic and add concurrent registration tests.
2. Add an outbox/idempotent notification path and rate-limit all registration entry points.
3. Move rate limiting to shared infrastructure.
4. Add CI, health/readiness checks, staging smoke tests, and a full core-journey e2e suite.
5. Bound public and organizer list queries and add missing indexes.

### P2 — MVP completion and trust

1. Implement or explicitly deprecate public race mutation/category APIs.
2. Add privacy controls, export, deletion/anonymization, and retention documentation.
3. Localize notifications and persist user locale; complete RTL/accessibility QA.
4. Complete durable storage and email delivery.

### P3 — Post-MVP

1. Payment gateway integration, refunds, and cancellation rules.
2. Marketplace/bib transfer only after fraud, payment, and organizer rules are specified.
3. Broader observability, performance budgets, and automated security regression testing.

## Recommended test additions

- Authorization matrix covering each role, blocked users, changed roles, organization membership changes, stale sessions, and MFA across credentials, web Google, and native Google.
- Upload security tests covering MIME spoofing, path traversal, public/private access, ownership binding, and payment-proof reassignment.
- Concurrent registration test proving capacity never becomes negative or exceeds configured capacity.
- Notification failure/idempotency test proving registration status is not ambiguous.
- Full Playwright journeys: discovery, signup/verification, registration, organizer approval/race publishing, admin moderation, invitation acceptance, and coach subscription.
- CI checks for lint, typecheck, build, Prisma validation, focused unit checks, e2e, migration status, and dependency audit.

## Final go/no-go assessment

**Go for continued MVP development; no-go for production payment evidence or privileged production operations until P0 findings are fixed.** The codebase is sufficiently implemented to continue feature work, but the security and concurrency issues need to be treated as release criteria rather than backlog polish.

