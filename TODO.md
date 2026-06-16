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
- Race discovery reads from Prisma when `DATABASE_URL` is configured, with mock fallback otherwise.
- Login redirects by role:
  - Runner -> `/account`
  - Organizer -> `/organizer`
  - Admin/Superadmin -> `/admin`
- Header hides login for authenticated users and shows an avatar/settings menu.
- Main website supports English, French, and Arabic entry points.
- UI supports light, dark, and race modes. Race mode uses flashy runner colors: lime green, pink, and purple.

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

## Current Priority

1. Build organizer onboarding:
   - Add an organization request form for regular users.
   - Save organization requests as `PENDING` organizations in PostgreSQL.
   - Attach the requester as organization owner/member.
   - Let admins approve or reject organizations.
   - Upgrade approved owners to `ORGANIZER` role.
   - Keep rejected organizations visible to admins with reason/status.

2. Build organizer race management:
   - Approved organizers can create races.
   - Organization-created races start as `PENDING_REVIEW`.
   - Pending races must not appear on the public website.
   - Organizers can edit their own draft/pending races.
   - Organizers can add/edit race categories.
   - Organizers can view participant lists.
   - Organizers can export participant CSV files.
   - Organizers can open/close registration when permitted.

3. Admin and superadmin follow-up:
   - Add superadmin-created platform race form.
   - Add admin edit/unpublish controls for races.
   - Add admin user role management.
   - Add audit logs for approval and rejection actions.

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

## Auth And Account Follow-Up

- Improve signup UX and validation messages.
- Add profile completion prompts before race registration when important fields are missing.
- Add registration cancellation or change-request actions.
- Add password reset later.
- Add Google login later, after email/password auth and profile flow stay stable.
- Defer Facebook/X/social login until policies and provider setup are clear.

## Organization Requirements

Organization fields:

- Name
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

## Race Requirements

Race fields:

- Race name
- Date and time
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

Rules:

- Public users can browse upcoming published races.
- Public users can filter races.
- Race details show full event information and registration CTA.
- Registration is blocked when the race is closed, full, cancelled, unpublished, or past deadline.
- Organization-created races stay hidden from public pages until admin approval.

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
- File uploads for race images, avatars, and participant documents.
- Payment workflow.
- Paid organizer subscriptions or paid race publishing.
- Bib transfer flow.
- Social login beyond Google.
- Rate limiting for auth endpoints.
- Security headers.
- Audit logs for admin actions.
- Deployment documentation.

## Deferred Bib Transfer Notes

Do not build this in the MVP. Before implementing, define:

- Whether each organizer must allow transfers.
- Whether RaceDZ handles payment or only connects users.
- Transfer deadline rules.
- ID verification rules.
- Refund and fraud policy.
- Whether the new runner must meet age/document requirements.

Recommended first version later: controlled bib transfer request, organizer approval, and full audit record for old participant, new participant, and approval time.

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
