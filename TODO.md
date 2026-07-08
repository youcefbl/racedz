# ZidRun TODO

This is the single source of truth for ZidRun product/backend planning. Use `UI_TODO.md` for public website, design, layout, navigation, and UX polish. Older planning notes in `backlog.md` and `requirment.md` are intentionally replaced by pointers to this file.

## Product Goal

ZidRun is an MVP platform for discovering, publishing, and registering for running races in Algeria.

The first useful version must let:

- Runners browse races, create accounts, register, track registrations, record runs, and follow a goal-based AI coaching plan.
- Organizations request organizer access, publish races, and manage participants.
- Admins and superadmins manage users, organizations, races, approvals, and platform health.

## Current State

- Stack is Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Zod, and Auth.js credentials auth.
- Public homepage, race listing, race details, login, signup, profile, registration, and account registrations exist.
- Public organizer information page exists at `/organizers`; the protected organizer dashboard remains `/organizer`.
- PostgreSQL schema exists for users, organizations, races, categories, and registrations.
- PostgreSQL schema now includes pending organization invitations.
- Race discovery reads from Prisma when `DATABASE_URL` is configured, with mock fallback otherwise.
- Login redirects by role:
  - Runner -> `/account/registrations`
  - Organizer -> `/organizer`
  - Admin/Superadmin -> `/admin`
- Header hides login for authenticated users and shows an avatar/settings menu.
- Main website supports English, French, and Arabic entry points.
- UI supports light, dark, and race modes. Race mode uses flashy runner colors: lime green, pink, and purple.
- MVP image uploads use local filesystem storage under `public/uploads`; later S3 migration should happen behind the existing storage helper.
- Notification MVP has started with database-backed in-app notifications and Resend email delivery tracking.
- Email verification is required for newly registered accounts.
- AWS staging/production deployment planning exists in `docs/AWS_DEPLOYMENT_PLAN.md`, including cost estimates and production security controls.
- AI coach MVP scope, architecture, safety boundaries, delivery phases, and API cost estimates are defined in `docs/AI_COACH_MVP_PLAN.md`.

## Completed MVP Work

- Email/password account creation.
- Email/password login with Auth.js.
- Google OAuth login/registration for verified Google emails.
- Login redirects after the first successful attempt instead of requiring a second submit.
- Sign out clears session UI in one attempt.
- Role-aware login redirect.
- Protected account, organizer, and admin routes.
- Runner profile edit form:
  - First name
  - Last name
  - Arabic full name
  - Phone
  - Gender
  - Date of birth
  - ID number
  - Avatar URL
  - Local avatar image upload
  - Wilaya
  - City
  - Commune
- Race registration loop:
  - Requires login.
  - Saves registrations to PostgreSQL.
  - Prevents duplicate registration for the same race category.
  - Blocks unavailable races.
  - Stores registration status and payment status.
  - Shows success and errors.
  - Shows saved registrations in `/account/registrations`.
- Runner login should land on `/account/registrations` by default so runners see their race entries first.
- Admin and superadmin dashboard:
  - Summary cards use aggregate/count queries.
  - Dashboard navigation covers users, organizations, races, and registrations.
  - User list is searchable/filterable.
  - Organization list is searchable/filterable.
  - Race list is searchable/filterable.
  - Registration list is searchable/filterable.
  - Registration list supports payment confirmed/not-confirmed filters, payment confirmation, and registration cancellation.
  - Organization approval/rejection is implemented.
  - Race approval/rejection is implemented.
- Account/profile dropdown:
  - Closes on outside click.
  - Closes on menu item selection.
  - Closes with Escape.
  - Closes after route changes.
- Organizer onboarding:
  - Authenticated runners can access `/organizer/request`.
  - Organization request form saves pending organizations to PostgreSQL.
  - The requester is attached as organization owner.
  - Admin approval flow can upgrade owners to organizer access.
  - Organization owners/admins can create pending invitations with explicit organization roles.
  - Pending invitations expose copyable invite links.
  - Organization invitations send branded email invite links while keeping copy-link fallback.
  - Organizer invite actions show clear email delivery diagnostics when Resend/config rejects an invite email.
  - Organization owners/admins can resend pending invitations with fresh links and revoke pending invitations.
  - Invited users can accept invitations from `/invite/[token]`.
  - Invite acceptance validates login, invited email, pending status, and approved organization status.
  - Accepted invitees become organization members and runners are upgraded to organizer access.
  - Organization owners/admins can update member roles.
  - Organization owners/admins can remove members with owner-lockout protections.
  - Organization requests and settings support local logo image upload.
  - Organization owners/admins can update organization profile details from `/organizer/settings`.
  - Admins can reject organizations with a stored rejection reason.
  - Admin organization list shows rejection reasons for rejected organizations.
  - Admin organization list shows organization logos when available.
- Organizer race management:
  - Approved organizers can create races from `/organizer/events/new`.
  - Organization-created races start as `PENDING_REVIEW`.
  - Organizer event list/detail pages read organization-owned races from PostgreSQL.
  - Organizer participant list and participant CSV export use organization ownership checks.
  - Organizer participant list supports search, pagination, registration-status filters, payment confirmed/not-confirmed filters, payment confirmation, and registration cancellation.
  - Organizers can open/close registration for their own published races.
  - Organizer registration controls now block reopening after race start, after registration deadline, with no categories, or when capacity is full.
  - Organizers can mark registration as full or cancelled for published races.
  - Organizers can edit their own draft, pending, or rejected races.
  - Organizers can add and edit race categories before publication.
  - Organizers can create multiple categories with different race types, distances, prices, and capacities during initial race creation.
  - Organizers can set category-specific race types for multi-race events.
  - Organizers can store a main race image path on race records.
  - Organizers can upload local main race images for new and editable races.
  - Image upload UI handles empty or invalid server responses without crashing.
  - Organizer race/category edits are recorded with timestamped history.
  - Race categories can have their own start time for multi-race event scheduling.
  - Public race detail pages show category-specific race types for multi-race events.
  - Organizer/admin race create and edit forms support a 48-hour auto-cancel policy for pending unpaid registrations.
  - Organizer/admin race create and edit forms support optional event-level elevation text and long-form race conditions.
  - Pending unpaid registrations are automatically cancelled after the configured 48-hour window when registration lists are opened.
- Admin race management:
  - Admins can approve, reject, and unpublish races.
  - Admins can edit race details, publication status, registration status, organizer contact, and race image from `/admin/races/[id]/edit`.
  - Admins can manage user roles, with superadmin safeguards.
  - Admin approval, rejection, unpublish, race edit, and role-change actions are recorded in an admin audit log.
  - Admins can view recent audit entries from `/admin/audit`.
  - Admin audit log can be filtered by actor, target type, and action.
  - Admin audit log shows readable metadata for changed fields, role changes, and rejection reasons.
  - Admin audit retention is bounded to 31 days for MVP maintenance.
  - Superadmins can view organizer race edit history.
  - Superadmins can create platform races directly from `/admin/races/new`.
  - Superadmins can upload local main race images while creating platform races.
- Dashboard navigation:
  - Admin panel has persistent mobile top tabs and desktop left navigation.
  - Organizer panel has persistent mobile top tabs and desktop left navigation.
- Quality and dev experience:
  - Manual QA checklist exists in `docs/QA_CHECKLIST.md`.
  - `npm run smoke` checks core public routes, protected redirects, public API JSON, upload auth rejection, Firebase service worker, and versioned CSS asset serving against the local dev server.
  - Browser e2e test strategy exists in `docs/E2E_TEST_STRATEGY.md`.
  - AWS deployment planning exists in `docs/AWS_DEPLOYMENT_PLAN.md`.
- Notifications:
  - Shared branded ZidRun email template is used by notification emails and account activation.
  - New account registration sends an activation email; login is blocked until email verification.
  - Notification, delivery, push subscription, and preference tables exist.
  - Header shows a notification bell with unread count and recent-notification dropdown.
  - Opening the notification dropdown marks unread notifications as read.
  - The fallback `/account/notifications` page also marks notifications read when opened.
  - Users can update notification email/push preferences from `/account/notification-settings`.
  - Firebase FCM server-side delivery and push-token registration API exist.
  - Notification settings can request browser notification permission and register an FCM token when Firebase public config is present.
  - Notification settings include reconnect and test-push controls with visible Firebase delivery feedback.
  - Organizer race submission notifies admins in-app and by email.
  - Admin race approval/rejection notifies organization members in-app and by email.
  - Admin race unpublish and publish-again actions notify organization members in-app, by email, and by push when configured.
  - Runner race registration creates in-app, email, and push notification attempts.
  - Admin race edits notify active race registrants in-app, by email, and by push when configured.
  - Organizer/admin race announcements notify active registrants and are visible on public race detail pages.
  - Resend email delivery status is recorded without blocking the core action on provider failure.
- Runner AI coach MVP foundation:
  - Coach goals, manually logged runs, versioned training plans/workouts, snapshots, interactions, and AI usage records have Prisma models and a migration.
  - Authenticated runner-owned APIs support coach dashboard data, goals, runs, AI interactions, and plan activation/cancellation.
  - Pace, training volume, trends, and weekly plan skeletons are calculated deterministically.
  - Safety rules detect explicit danger signals in English, French, and Arabic; unsafe requests are blocked before an OpenAI call.
  - AI-generated workouts are constrained to deterministic dates, workout types, and distance limits.
  - OpenAI Responses API integration uses server-only configuration, Structured Outputs, Zod validation, provider failure handling, rate limits, and token/cost logging.
  - Focused coach metrics, planning, and safety checks run with `npm run test:coach`.
  - `/account/coach` provides mobile-first goal onboarding, progress metrics, manual run logging/history, weekly plan review/acceptance, post-run feedback, and coach conversation views.
  - Coach UI copy supports English, French, and Arabic with RTL layout and the existing light/dark/race theme system.
  - Playwright covers authenticated goal/run/provider-failure behavior; `RACEDZ_REQUIRE_LIVE_AI=1 npm run test:e2e:coach` enables the paid live OpenAI assertion.
- Backlog UI fixes:
  - Removed duplicated Create item from organizer panel navigation.
  - Made dashboard left navigation flush with the left edge on desktop.
  - Fixed Invite organization user form overflow in the organizer members panel.
  - Switched sign-out to client-side Auth.js redirect to avoid stale authenticated UI after logout.
  - Fixed local development to one canonical app URL, `http://127.0.0.1:3003`, so Auth.js redirects do not drift between ports.
  - Fixed dark/race-mode textarea styling so description fields match the active theme.
  - Aligned admin and organizer race creation category forms with repeatable categories, separated distance/price/capacity/start-time fields, and required race descriptions without a long minimum.
  - Added show/hide password controls to the signup password fields.
  - Removed city from the signup form while keeping wilaya required.
  - Refactored the public top bar to show only visitor-facing Races and Organizers links; admin access stays inside the authenticated account menu.
  - Added `/organizers` as the public explanation page for organization teams before they request organizer access.
  - Race detail pages show the runner's existing registration status/details instead of a register CTA when already registered.

## Current Priority

1. Quality and dev experience:
   - Add CI command that runs lint, typecheck, build, and smoke checks against a started test server.
   - Expand smoke checks into Playwright browser e2e journeys with deterministic test data reset/seed.
   - Add lightweight MVP usage analytics:
     - Track first-week platform usage events without collecting sensitive form content.
     - Track user sessions, visited major sections, key actions, approximate session duration, and last activity.
     - Track where users leave the platform when possible.
     - Add regression/error reporting for client and server errors.
     - Keep analytics privacy-conscious and document retention before production.

2. Notifications:
   - Improve branded email template UI/UX across all ZidRun emails.
   - Add payment proof review notifications.
   - Add race reminder jobs.
   - Do not build wilaya race alerts for now.

3. Admin and superadmin follow-up:
   - Add admin/superadmin-only MFA before production admin access:
     - Require a second factor only for `/admin/*`.
     - Do not require MFA for organization/organizer dashboards in the MVP.
     - Prefer TOTP authenticator apps for production; email OTP can be a temporary fallback.
   - Add exportable admin audit reports later only if compliance/support needs justify it.

4. Runner AI coach MVP ([detailed plan](docs/AI_COACH_MVP_PLAN.md)):
   - Confirm coaching product rules and have initial safety rules reviewed by a qualified running coach or sports-health professional.
   - Enable OpenAI project billing/quota and rerun the live provider test; the configured key currently returns `insufficient_quota`.
   - Complete cross-theme and RTL visual QA for the coach workflow.
   - Add API authorization integration tests, prompt/output evaluations, and data deletion/export rules.
   - Release first to a closed beta of 50 to 100 runners; defer GPS, wearables, live voice, medical guidance, fine-tuning, and vector search.

## Coach — deferred items & required infra actions (from 2026-07-08 gap-fix pass)

A multi-agent audit of the coach subsystem was fixed in code (correctness, payment-proof security,
sleep-parse cost gate, payment/expiry notifications, self-service cancel/withdraw, safety-reason +
goal-form + email i18n, Sentry in cron, FCM android block). See the `coach-subscription-flow`
memory. These were **deliberately deferred** and still need doing:

### Deferred (code work, not done yet)
- **Race/organizer notification i18n.** All race/approval/announcement/registration notifications in
  `src/lib/notifications.ts` are English-only for every recipient. Needs a `User.locale` field
  (there is none today — coach uses `RunnerGoal.preferredLocale`). Add `User.locale`, backfill, and
  thread it into every `notify*` builder (title/body/subject).
- **GDPR self-service account/data deletion.** A runner cannot delete their account or coach data
  (goals, runs+GPS, sleep logs, payment proofs). Only admin-initiated deletion exists. Payment-proof
  files in particular persist. Build a self-service purge (DB rows + upload artifacts).
- **workout-i18n completeness test.** No test runner is configured in the repo, so a guard that every
  literal `planning.ts`/`safety.ts` emits has an fr/ar entry in `workout-i18n.ts` was skipped. Add
  it when a test runner (vitest/jest) is set up. The map is currently complete.
- **Native FCM payload polish.** An `android` block was added; verify tap-routing once native tokens
  exist, and add native crash reporting (see below).

### Required infra actions (cannot be done in code — owner must do)
- **Android push:** ship `android/app/google-services.json` (from Firebase console), rebuild the APK
  with it present, get users onto that APK, THEN set `NEXT_PUBLIC_NATIVE_PUSH_ENABLED=true` in the
  server `.env.production` and `./deploy.sh`. Enabling the flag before the APK has google-services.json
  crash-loops `register()`. Server also needs `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`.
- **Email:** confirm `RESEND_API_KEY` + `EMAIL_FROM` set in prod (else all email silently fails).
- **Deploy:** the `Caddyfile` changed (403s `/uploads/coach-payment/*`). After `git pull && ./deploy.sh`,
  reload Caddy: `docker compose --env-file .env.production -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile` (a bind-mounted Caddyfile is NOT auto-reloaded by `up -d`).
- **Mobile crash reporting:** add `@sentry/capacitor` for native crash + device details (see below).

### Mobile crash reporting
Decision (Sentry's paid floor isn't worth it): **Firebase Crashlytics for native crashes; web/JS
error capture deferred.**
- **Native crashes → Firebase Crashlytics (WIRED, free/unlimited).** `firebase-crashlytics-gradle`
  classpath in `android/build.gradle`; `firebase-crashlytics` dependency + `com.google.firebase.crashlytics`
  plugin (applied only when `google-services.json` exists) in `android/app/build.gradle`. Auto-inits,
  no app code. **Activates automatically once `google-services.json` is added (the same file as push)
  and the APK is rebuilt.** Captures native + JVM crashes, ANRs, device context, logs — viewable in
  the Firebase console → Crashlytics. Force a test crash from native code to confirm ingestion.
- **Web/JS (webview) errors → deferred.** `@sentry/nextjs` is still in the repo but dormant (no DSN).
  When wanted, add a small custom `/api/log/error` endpoint into the app DB + an admin view (free), or
  self-host GlitchTip (Sentry-compatible) if a full dashboard is worth the hosting.
- Server-side cron/AI errors currently log to stdout (docker logs) + call `Sentry.captureException`
  (no-op without a DSN; lights up free if GlitchTip is ever self-hosted).

## Public Website

- Keep the design clean, minimalist, mobile-first, and easy to scan.
- Use energetic runner accents for CTAs, race status, distance badges, featured races, and key highlights.
- Keep dashboards quiet and operational with dense tables, filters, status badges, and clear actions.
- Race cards must clearly show:
  - Date
  - Wilaya/city
  - Distance
  - Price
  - Registration status
  - Registration action
- Race listing should support filters for:
  - Search text
  - Wilaya
  - City/commune
  - Date
  - Distance
  - Race type
  - Registration status
- Improve language support:
  - Preserve selected language across public navigation.
  - Continue English, French, and Arabic copy coverage.
  - Extend English, French, and Arabic coverage across public and organizer-facing pages.
  - Keep admin-only pages in English for now.
  - Add RTL polish for Arabic screens.
- Improve theme support:
  - Check contrast and focus states in light, dark, and race modes.
  - Ensure account/admin/organizer pages look correct in all three modes.

## Marketplace Requirements

Do not build this before the core race/registration/admin flows are stable.

Marketplace goal:

- Let normal users post running-related goods for sale.
- Admins review and approve listings before they appear publicly.
- Public users can browse approved marketplace listings.

Marketplace is not part of the MVP.

Marketplace listing fields:

- Item name
- Images
- Description
- Condition: new or used
- Price
- Category
- Seller
- Approval status: pending, approved, rejected, sold, archived

Initial marketplace categories:

- Race consumables such as gels and hydration products
- Race clothes
- Running accessories
- Race registration or bib transfer listings, only after transfer, fraud, organizer approval, and payment rules are specified

Marketplace rules:

- Listings stay hidden until admin approval.
- Server-side authorization is required for create, edit, approval, rejection, and archive actions.
- Use the local upload adapter for MVP listing images, then move to S3-compatible storage later.
- Race registration resale must follow the deferred bib transfer policy before becoming public.

## Auth And Account Follow-Up

- Improve signup UX and validation messages.
- Add user avatar upload/display.
- Add profile completion prompts before race registration when important fields are missing.
- Add registration cancellation or change-request actions.
- Do not allow runner self-cancellation or refunds in the MVP.
- Add password reset later.
- Defer Facebook/X social login until missing-email and account-linking policies are clear.

## Organization Requirements

Organization fields:

- Name
- Logo/avatar image
- Contact email
- Contact phone
- Wilaya
- City/commune
- Description
- Website/social links
- Approval status: pending, approved, rejected, suspended

Rules:

- Users can request an organizer account.
- Admins approve or reject organizations.
- Approved organizations can create races.
- Organization-created races require admin approval before publication.
- Organization-created races may later require a paid publishing plan.
- Organizations can have many users.
- Organization users must have explicit roles such as owner, admin, or member.
- The user who creates the organization becomes the initial owner/admin.
- Organization owner/admin users can invite other users to the organization.
- Invited users should not gain access until the invite is accepted.
- Organization role checks must happen on the server for every organization-owned action.

## Race Requirements

Race fields:

- Race name
- Date and time
- Optional race-specific date and time when an event has multiple race starts
- Wilaya
- City/commune
- Full location/address
- Description
- Pictures
- Race distances/categories
- Registration status: not open yet, open, closed, full, cancelled
- Total places
- Remaining places
- Organization name/profile
- Price
- Registration deadline
- Race type: road, trail, marathon, half marathon, 10K, 5K, kids, charity, other
- Edit history: changed fields, previous values, new values, editor, and timestamp

Rules:

- Public users can browse upcoming published races.
- Public users can filter races.
- Race details show full event information and registration CTA.
- Registration is blocked when the race is closed, full, cancelled, unpublished, or past deadline.
- Organization-created races stay hidden from public pages until admin approval.
- One event can contain multiple races/categories with different distances, race types, prices, capacities, and start dates.
- Organizer edits to race details should be recorded in a timestamped history visible to superadmins.

## Admin And Superadmin Rules

- Admin can list and manage users.
- Admin can list and manage organizations.
- Admin can approve/reject organizations.
- Admin can approve/reject/edit/unpublish races.
- Superadmin can create platform races directly.
- Platform-created races are marked as `PLATFORM`.
- Platform-created races do not require organization payment.
- Platform-created races still show organizer/contact information publicly.

## Later Features

- Organizer demo/onboarding guide explaining how to use the platform.
- Notifications.
- Move uploads from local filesystem storage to S3-compatible object storage.
- File uploads for organization logos and participant documents.
- Payment workflow.
- Manual payment tracking only for MVP; do not integrate a payment gateway yet.
- Paid organizer subscriptions or paid race publishing.
- Bib transfer flow.
- Social login beyond Google.
- Rate limiting for auth endpoints.
- Security headers.
- Audit logs for admin actions.
- Race edit history for organizer changes.
- Staging and production AWS deployment implementation from `docs/AWS_DEPLOYMENT_PLAN.md`.
- Registration resale marketplace.
- Admin-approved marketplace for running goods.

## Blog

Shipped: file-backed trilingual MDX blog at `/blog` (posts in `src/content/blog/<slug>/{en,fr,ar}.mdx`), SEO (sitemap/robots/OG/JSON-LD/hreflang), 3 seed posts. See the `blog-mdx-conventions` memory.

### Features to add
- **Comments from registered runners.** Let signed-in runners comment on a post; guests can read only.
  - Prisma `BlogComment` model: `id, postSlug, locale?, authorId (User), body, status (PENDING|PUBLISHED|HIDDEN), createdAt, @@index([postSlug, status])`.
  - `POST /api/blog/[slug]/comments` — auth-gated (registered only), with rate limiting per the security-hardening conventions; validate/trim body length; reject empty.
  - Moderation: reuse the existing Reports/moderation admin infra (see `admin-platform-management` memory) so comments are reportable and an admin can hide/delete. Decide pre-moderation (default PENDING) vs auto-publish + report-driven takedown.
  - UI on the article page: published-comment list (server-rendered from DB) + a comment form (client component) for signed-in users; a "sign in to comment" prompt otherwise. Note: comments make the article page dynamic (DB-backed) rather than pure-static.
  - Verify prices/TODO markers in seed posts are resolved before heavy promotion (owner to confirm Algerian retail).

### Content backlog (planned posts — all need EN + FR + AR)
Shipped for launch (7 posts total): best shoes, best watches, must-have accessories, heart-rate zones/Zone 2, what's a good 5K time, road vs trail shoes, race distances & records.

Still to write:
- Training
  - Mental training during a run (focus, dealing with the "wall", motivation).
  - Sports that pair well with running (cross-training: swimming, cycling, strength).
- Nutrition
  - Best timing for food before and after a run (what and when).
- Gear
  - Foot types (flat/neutral/high-arch, pronation) and the best shoe for each.
- Health / recovery
  - Best recovery methods (sleep, stretching, foam rolling, rest days, ice/heat).

## QA And Testing Requirements

Add a full QA flow that behaves like a product tester checklist before release.

Core flows to cover:

- Public visitor browses races, filters races, changes language, and changes theme.
- Runner signs up, logs in, edits profile, uploads avatar, registers for a race, and sees the saved registration.
- Organizer requests organization access, receives approval, invites members, creates a race, uploads race image, edits categories, and manages participants.
- Admin approves/rejects organizations, approves/rejects/unpublishes races, manages users, and reviews registrations.
- Superadmin creates a platform race and views race edit history.
- Auth redirects keep the current local host/port and never redirect to stale localhost ports.
- Uploads reject invalid file types and files larger than the configured limit.

Testing implementation:

- Start with a manual QA checklist in the repo.
- Add automated smoke/e2e tests for the highest-value paths.
- Keep test data isolated from real user data.
- Prefer deterministic fixtures for users, organizations, races, categories, and registrations.

## Deferred Bib Transfer Notes

Do not build this in the MVP. This covers selling/transferring a race registration, bib, or registration package before race day.

Decision: bib transfer and registration resale are not part of the MVP.

Before implementing, define:

- Whether each organizer must allow transfers.
- Whether ZidRun handles payment or only connects users.
- Transfer deadline rules.
- ID verification rules.
- Refund and fraud policy.
- Whether the new runner must meet age/document requirements.
- Whether the seller can post a public marketplace listing.
- Whether the organizer must approve each sale or transfer before it becomes valid.

Recommended first version later: controlled registration transfer request, organizer approval, and full audit record for old participant, new participant, and approval time. Avoid an open marketplace until fraud, moderation, and payment rules are clear.

## Security And Performance Requirements

- Treat API security as part of every feature, not a final cleanup task.
- Follow OWASP Top 10 practices:
  - Server-side authorization on every protected route and action.
  - Zod validation for all request bodies and form submissions.
  - Avoid exposing sensitive user, payment, or admin data.
  - Use secure Auth.js sessions and keep `AUTH_SECRET` private.
  - Keep `.env`, uploads, and secrets out of Git.
  - Avoid unsafe redirects; only allow safe internal callback URLs.
  - Use CSRF-safe server actions or protected route handlers for mutations.
  - Add rate limiting before production for auth and write-heavy endpoints.
- Optimize database access:
  - Use pagination for admin and public lists.
  - Use `count` and aggregate queries for dashboard stats.
  - Select only fields needed by each page/API.
  - Avoid loading full tables for dashboards.
  - Add indexes/migrations when filters become hot paths.
  - Consider caching public race discovery after write flows are stable.
- Keep quality gates:
  - Run `npm run lint`.
  - Run `npm run typecheck`.
  - Run `npm run build` for meaningful app changes.
  - Add focused tests when shared domain logic or critical flows become complex.

## Security Review (do a full pass before production)

A dedicated end-to-end security audit covering the API, route handlers, server actions, the
mobile app, and data handling. Run the repo `/security-review` on the diff per feature, and
commission an external review before public launch. Checklist:

### Authentication and sessions
- Re-verify every protected route handler AND server action calls `auth()`/`requireAdmin()` server-side; no client-only gating.
- `AUTH_SECRET` strong and out of git; production session cookies `httpOnly` + `secure` + `sameSite`.
- Email verification enforced on credentials login; Google sign-in limited to verified emails.
- Admin/superadmin MFA before production (already tracked).
- Rate-limit auth-sensitive endpoints: login, register, invite accept, future password reset.
- No account enumeration in login/register/reset responses.

### Authorization (IDOR / ownership)
- Coach goals, runs, plans, interactions, subscriptions: every query scoped to `userId` (audit all `$queryRaw`/`$executeRaw`).
- Organizer event/participant/member actions: server-side organization-role checks on every mutation.
- Admin-only actions (race approval, role changes, coach subscription activate/deactivate) gated + audited.
- Attempt cross-user/cross-org access in tests; expect 403/404.

### Input validation and injection
- Zod-validate every API body and server-action input; audit for any unvalidated path.
- All raw SQL parameterized (template tags only); no string interpolation of user input; no `Prisma.raw` with user data.
- Uploads: validate type/size/extension, sanitize filename, store non-executable, re-encode images; enforce limits.
- Cap oversized payloads (GPS route array, long text fields).

### Data exposure and privacy
- API responses select only needed fields (never `passwordHash`, tokens, other users' PII).
- Sensitive coach data (injuries, chronic conditions, weight) and GPS routes: access control + documented retention + export/delete + consent.
- GPS routes reveal home/work — treat as sensitive; consider trimming route ends if ever shared/public.
- No secrets/PII in logs; `OPENAI_API_KEY`, Resend, FCM server keys server-only; audit that no secret is exposed via `NEXT_PUBLIC_`.

### Web headers, transport, CSRF, redirects
- HTTPS + HSTS in production.
- Security headers: CSP, `frame-ancestors`/X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- Confirm custom POST route handlers are CSRF-safe (origin check or same-site cookie); server actions are already protected.
- Validate `callbackUrl`/redirect params to internal paths only (no open redirect).
- Lock down CORS on API route handlers.

### Mobile app (Capacitor)
- Release build loads remote HTTPS only; cleartext HTTP disabled (dev-only via `CAP_SERVER_URL`).
- Review webview session/cookie handling; keep sensitive tokens out of `localStorage`.
- Background location: explicit consent + Play Store data-safety disclosure; request minimal scope; transmit location only when saving a run; the offline run queue stores routes in `localStorage` — review retention/clearing.
- Validate deep links / custom schemes; review Android `allowBackup` (currently true — can expose data via adb backup) and exported components.
- Google OAuth fails in embedded webview (`disallowed_useragent`) — use native sign-in or system browser.
- Sign release builds; never ship debug; run `npm audit` (Capacitor deps currently flag moderate/high).

### Rate limiting, abuse, cost
- AI coach per-user daily/monthly limits + off-topic guard enforced server-side and not bypassable.
- Rate-limit write-heavy/public endpoints (registration, invites, uploads, run logging).
- OpenAI spend cap + monthly budget alert.

### Dependencies and operations
- Resolve `npm audit` findings; pin/lock deps; vet new mobile plugins' permissions and network behavior; upgrade Node off EOL 18.
- Production secrets management + rotation; DB least-privilege + backups; no stack traces leaked to clients; error monitoring + basic incident response.

### Open findings from review (2026-06-22) — fix before production
- MEDIUM: Pre-registration account takeover via Google linking (`src/auth.ts` `getOrCreateGoogleUser`). Google sign-in marks an existing unverified credentials account verified without clearing a possibly attacker-set `passwordHash`. Fix: when linking Google to an account with a `passwordHash` and no prior `emailVerifiedAt`, null the `passwordHash` (force reset).
- LOW/MED: No rate limiting on auth + write endpoints; off-topic chat writes a BLOCKED `CoachInteraction` row before the quota check (DB bloat). Add endpoint rate limiting; count/limit BLOCKED interactions.
- LOW: Android `allowBackup="true"` lets `adb backup` extract app data incl. the offline GPS run queue (home/work coords). Set `android:allowBackup="false"` for release.
- INFO: Add security headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) in `next.config`. Verify release mobile build uses the `https://` domain (cleartext is dev-only) and Auth.js `callbackUrl` stays same-origin.

## Two-PC Development Workflow

Best workflow:

- Use Git as the source of truth for code.
- Push every finished work session to a remote repository such as GitHub/GitLab.
- On the other PC, pull the same branch before starting.
- Do not copy `node_modules`, `.next`, or local generated files between PCs.
- Keep `.env` out of Git. Copy `.env.example` and create a local `.env` on each PC.
- Use Docker PostgreSQL on each PC for local development.
- Use Prisma migrations and seed data to recreate the database:
  - `docker compose up -d postgres`
  - `npm install`
  - `npm run prisma:generate`
  - `npm run prisma:migrate`
  - `npm run prisma:seed`
  - `npm run dev`
- If you need the exact same local data on both PCs, export/import PostgreSQL dumps manually. Otherwise, use migrations plus seed data.
- Keep Codex context in repo files:
  - `TODO.md`
  - `CODEX_CONTEXT.md`
  - `AGENTS.md`
- Start each Codex session by asking it to read `TODO.md`, `CODEX_CONTEXT.md`, and `AGENTS.md`.
- You cannot reliably keep the same live Codex chat session across two PCs. The practical replacement is a clean Git history plus these context files.

Recommended branch habit:

- Work on one feature branch at a time.
- Before moving PCs:
  - Run checks.
  - Commit.
  - Push.
- On the other PC:
  - Pull.
  - Run migrations if schema changed.
  - Continue from `TODO.md`.
