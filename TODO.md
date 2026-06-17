# RaceDZ TODO

This is the single source of truth for RaceDZ planning. Older planning notes in `backlog.md` and `requirment.md` are intentionally replaced by pointers to this file.

## Product Goal

RaceDZ is an MVP platform for discovering, publishing, and registering for running races in Algeria.

The first useful version must let:

- Runners browse races, create accounts, register, and track registrations.
- Organizations request organizer access, publish races, and manage participants.
- Admins and superadmins manage users, organizations, races, approvals, and platform health.

## Current State

- Stack is Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Zod, and Auth.js credentials auth.
- Public homepage, race listing, race details, login, signup, profile, registration, and account registrations exist.
- PostgreSQL schema exists for users, organizations, races, categories, and registrations.
- PostgreSQL schema now includes pending organization invitations.
- Race discovery reads from Prisma when `DATABASE_URL` is configured, with mock fallback otherwise.
- Login redirects by role:
  - Runner -> `/account`
  - Organizer -> `/organizer`
  - Admin/Superadmin -> `/admin`
- Header hides login for authenticated users and shows an avatar/settings menu.
- Main website supports English, French, and Arabic entry points.
- UI supports light, dark, and race modes. Race mode uses flashy runner colors: lime green, pink, and purple.
- MVP image uploads use local filesystem storage under `public/uploads`; later S3 migration should happen behind the existing storage helper.

## Completed MVP Work

- Email/password account creation.
- Email/password login with Auth.js.
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
- Admin and superadmin dashboard:
  - Summary cards use aggregate/count queries.
  - Dashboard navigation covers users, organizations, races, and registrations.
  - User list is searchable/filterable.
  - Organization list is searchable/filterable.
  - Race list is searchable/filterable.
  - Registration list is searchable/filterable.
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
- Admin race management:
  - Admins can approve, reject, and unpublish races.
  - Admins can edit race details, publication status, registration status, organizer contact, and race image from `/admin/races/[id]/edit`.
  - Admins can manage user roles, with superadmin safeguards.
  - Admin approval, rejection, unpublish, race edit, and role-change actions are recorded in an admin audit log.
  - Admins can view recent audit entries from `/admin/audit`.
  - Superadmins can view organizer race edit history.
  - Superadmins can create platform races directly from `/admin/races/new`.
  - Superadmins can upload local main race images while creating platform races.
- Dashboard navigation:
  - Admin panel has persistent mobile top tabs and desktop left navigation.
  - Organizer panel has persistent mobile top tabs and desktop left navigation.
- Backlog UI fixes:
  - Removed duplicated Create item from organizer panel navigation.
  - Made dashboard left navigation flush with the left edge on desktop.
  - Fixed Invite organization user form overflow in the organizer members panel.
  - Switched sign-out to client-side Auth.js redirect to avoid stale authenticated UI after logout.
  - Fixed local development to one canonical app URL, `http://127.0.0.1:3003`, so Auth.js redirects do not drift between ports.
  - Fixed dark/race-mode textarea styling so description fields match the active theme.
  - Aligned admin and organizer race creation category forms with repeatable categories, separated distance/price/capacity/start-time fields, and required race descriptions without a long minimum.

## Current Priority

1. Build organizer onboarding:
   - Add email delivery later if manual copy links are not enough.

2. Build organizer race management:
   - Add public race-detail polish for showing category-specific race types more prominently.

3. Admin and superadmin follow-up:
   - Add audit log filters by actor, target type, and action.

4. Quality and dev experience:
   - Add a documented QA test flow that covers public browsing, auth, runner registration, organizer onboarding, race management, admin approvals, uploads, and role redirects.
   - Add automated smoke/e2e tests for the main user journeys after the flows are documented.

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
- Add password reset later.
- Add Google login later, after email/password auth and profile flow stay stable.
- Defer Facebook/X/social login until policies and provider setup are clear.

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

- AI chat support.
- Organizer demo/onboarding guide explaining how to use the platform.
- Notifications.
- Move uploads from local filesystem storage to S3-compatible object storage.
- File uploads for organization logos and participant documents.
- Payment workflow.
- Paid organizer subscriptions or paid race publishing.
- Bib transfer flow.
- Social login beyond Google.
- Rate limiting for auth endpoints.
- Security headers.
- Audit logs for admin actions.
- Race edit history for organizer changes.
- Deployment documentation.
- Registration resale marketplace.
- Admin-approved marketplace for running goods.

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

Before implementing, define:

- Whether each organizer must allow transfers.
- Whether RaceDZ handles payment or only connects users.
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
