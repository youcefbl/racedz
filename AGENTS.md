# Agent Notes For RaceDZ

These notes are for AI coding agents working on RaceDZ. Read this file alongside `TODO.md` (the single source of truth for planning) and `CODEX_CONTEXT.md` (architecture notes and current raw-SQL context) before making changes.

- `backlog.md` and `requirment.md` are intentionally only pointers to `TODO.md`; do not add planning content there.
- Do not commit `.env` files or uploaded user files.

---

## Project Overview

RaceDZ is an MVP platform for discovering, publishing, and registering for running races in Algeria. It targets three audiences:

- **Runners** – browse races, create accounts, register, and track registrations.
- **Organizations / Organizers** – request organizer access, publish races, manage participants, and invite team members.
- **Admins / Superadmins** – manage users, organizations, races, approvals, audit logs, and platform health.

Working name: `RaceDZ`. Package name: `racedz`. Database name: `racedz`.
Tagline: "Find, register, and manage races across Algeria."

### Repository

- Root: `/home/youcef/Documents/work/racedz`
- Main language: English (all docs and code comments).
- Git is the source of truth for multi-PC work; see `NEW_PC_SETUP.md` for SSH/Git workflow.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 App Router |
| Language | TypeScript 5.7 |
| Frontend | React 19 |
| Styling | Tailwind CSS 3.4 |
| UI primitives | Custom components in `src/components/ui` (shadcn/ui-style, not installed via CLI) |
| ORM | Prisma 5.21 |
| Database | PostgreSQL 16 |
| Auth | Auth.js 5 beta (`next-auth`) credentials provider |
| Validation | Zod |
| File storage | Local filesystem MVP (`public/uploads`), S3 stubs in `.env.example` |

Key versions from `package.json`:

- `next`: `^15.0.0`
- `react`: `^19.0.0`
- `@prisma/client`: `^5.21.1`
- `next-auth`: `^5.0.0-beta.25`
- `zod`: `^3.24.1`
- `bcryptjs`: `^2.4.3`

---

## Local Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment file:

   ```bash
   cp .env.example .env
   ```

3. Start local PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

4. Generate Prisma client, run migrations, and seed:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   The canonical local URL is fixed at `http://127.0.0.1:3003`. Auth.js redirects are configured for this origin; do not rotate ports. If `3003` is busy, stop the other process rather than changing the port.

### Demo Accounts

Created by `prisma/seed.ts`:

| Email | Role | Password |
|-------|------|----------|
| `admin@racedz.dz` | SUPERADMIN | `racedz-demo-password` |
| `organizer@racedz.dz` | ORGANIZER | `racedz-demo-password` |
| `runner@example.com` | RUNNER | `racedz-demo-password` |

---

## Build, Test, and Quality Commands

Defined in `package.json`:

```bash
npm run dev          # next dev --hostname 127.0.0.1 --port 3003
npm run build        # next build
npm run start        # next start
npm run lint         # eslint .
npm run typecheck    # tsc --noEmit
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed  # tsx prisma/seed.ts
```

After meaningful code changes, run:

```bash
npm run lint
npm run typecheck
npm run build
```

For docs-only changes, do a targeted content check instead of a full build.

### Testing

- There are currently **no automated tests** in the repo (no Jest, Vitest, Playwright, or Cypress).
- `TODO.md` calls for a manual QA checklist first, then automated smoke/e2e tests for core journeys.
- Add focused tests when changing shared domain logic, authorization, registration, payments, organization membership, or admin approvals.
- Keep test data isolated from real data and use deterministic fixtures for users, organizations, races, categories, and registrations.

---

## Code Organization

```
prisma/
  schema.prisma        # Data model
  seed.ts              # Demo users, orgs, races, registrations
  migrations/          # Prisma migration files

src/
  app/                 # Next.js App Router pages + API route handlers
    page.tsx           # Public homepage
    layout.tsx         # Root layout with theme anti-flash script
    globals.css        # Tailwind + CSS variables for light/dark/race modes
    about/             # Static public page
    contact/
    terms/
    privacy/
    login/             # Credentials login (server action)
    register/          # Email/password signup
    account/           # Runner dashboard, profile, registrations
    races/             # Public race listing + race detail
    races/[slug]/register/   # Race registration form
    organizer/         # Organizer dashboard, events, members, settings, request
    admin/             # Admin + superadmin dashboard
    invite/[token]/    # Organization invite acceptance
    api/               # Route handlers
      auth/[...nextauth]/route.ts
      races/
      uploads/
      me/registrations/
      organizer/events/
      admin/organizations/
      admin/races/

  components/          # Reusable UI components
    layout/            # SiteHeader, SiteHeaderClient, AccountMenu, DashboardShell, ThemeSwitcher, LanguageSwitcher, SiteFooter, RaceDZLogo
    ui/                # Button, Badge
    forms/             # ImageUploadField
    races/             # RaceCard, RaceSearchForm

  lib/                 # Domain helpers and shared logic
    admin.ts           # Admin/superadmin helpers, audit log
    algeria.ts         # Wilaya list
    auth.ts            # getCurrentUser()
    db.ts              # Prisma client singleton
    format.ts          # Date / DZD / distance formatters
    i18n.ts            # en/fr/ar dictionaries + helpers
    organizations.ts   # Organization request creation
    organizer.ts       # Organizer dashboard, invitations, race CRUD, members
    permissions.ts     # hasRole(), canManageRace()
    race-repository.ts # DB-aware race reads with mock fallback
    race-slugs.ts      # Unique slug generator
    races.ts           # Labels, sample data, filter logic
    registrations.ts   # Race registration creation
    storage.ts         # Local image upload boundary
    utils.ts           # cn() Tailwind helper
    validations.ts     # All Zod schemas

  types/
    next-auth.d.ts     # Session/JWT module augmentation
    race.ts            # Domain types mirroring Prisma enums

middleware.ts          # Route guards for /account, /organizer, /admin
src/auth.ts            # NextAuth / Auth.js configuration
next.config.ts         # Empty Next.js config
```

### Naming Conventions

- App Router routes: route segments as directories; `page.tsx`, `layout.tsx`, `actions.ts`.
- API routes: `src/app/api/<resource>/route.ts`, nested `[id]/sub/route.ts` where needed.
- Components: PascalCase file names (`site-header.tsx` exports `SiteHeader`).
- Domain helpers: kebab-case files exporting async camelCase functions and custom `*Error` classes (`OrganizerError`, `AdminError`, `UploadError`).
- Forms: `*-form.tsx`.
- Types: `src/types/race.ts` for domain types; `src/types/next-auth.d.ts` for session augmentation.
- Path alias: `@/*` maps to `./src/*`.

---

## Authentication & Authorization

### Auth Configuration (`src/auth.ts`)

- Provider: `Credentials` from `next-auth/providers/credentials`.
- Session strategy: **JWT**.
- Custom sign-in page: `/login`.
- `trustHost: true`.
- `authorize` validates with `loginSchema`, lowercases email, and compares `passwordHash` with `bcrypt`.
- Returned user object: `id`, `email`, `name`, `role`, `organizationIds`.
- JWT callback attaches `role` and `organizationIds`.
- Session callback exposes `session.user.id`, `session.user.role`, and `session.user.organizationIds`.

### Session Type Augmentation (`src/types/next-auth.d.ts`)

Extends `next-auth` `User`/`Session` and `next-auth/jwt` `JWT` with `role` and `organizationIds`.

### Middleware (`middleware.ts`)

Matcher: `"/account/:path*"`, `"/organizer/:path*"`, `"/admin/:path*"`.

- Unauthenticated users on protected routes → `/login?callbackUrl=<path>`.
- `/admin/*` requires `ADMIN` or `SUPERADMIN`; otherwise redirected to `/account`.
- `/organizer/request` is allowed for any authenticated user.
- Other `/organizer/*` require `ORGANIZER`, `ADMIN`, or `SUPERADMIN`; otherwise redirected to `/organizer/request`.

### Permission Helpers (`src/lib/permissions.ts`)

- `hasRole(userRole, requiredRole)` – rank-based check (`RUNNER=1` … `SUPERADMIN=4`).
- `canManageRace(userRole, ownerOrganizationId, userOrganizationIds)` – admin/superadmin bypass; organizer must belong to the owning organization.

### Current User Helper (`src/lib/auth.ts`)

- `getCurrentUser()` returns `AppSessionUser` (`id`, `email`, `role`, `organizationIds`).

### Role-Based Redirects (`src/app/login/actions.ts`)

After successful login:

- `ADMIN` / `SUPERADMIN` → `/admin`
- `ORGANIZER` → `/organizer`
- `RUNNER` / default → `/account`

`getSafeCallbackUrl` rejects non-path URLs and protocol-relative URLs. `canUseCallbackForRole` validates that callback paths under `/admin` or `/organizer` match the user's role.

---

## Database Layer

### Client (`src/lib/db.ts`)

`getPrisma()` returns a global singleton `PrismaClient` in development; fresh instance in production.

### Schema (`prisma/schema.prisma`)

**Models:**

- `User` – id, email (unique), passwordHash, names, arabicFullName, phone, role, gender, DOB, nationalId (unique), avatarUrl, wilaya/city/commune.
- `Organization` – id, name, slug (unique), description, contacts, socials, logoUrl, location, status, rejectionReason.
- `OrganizationMember` – id, userId, organizationId, role (`OWNER`/`ADMIN`/`MEMBER`), `@@unique([userId, organizationId])`.
- `OrganizationInvitation` – id, organizationId, email, role, status (`PENDING`/`ACCEPTED`/`REVOKED`), invitedById, token (unique), createdAt, acceptedAt.
- `RaceEvent` – id, organizationId (nullable), source (`ORGANIZATION`/`PLATFORM`), title, slug (unique), description, raceType, status, registrationStatus, dates, location, contact, image, capacity fields.
- `RaceCategory` – id, raceEventId, name, raceType, distanceKm, elevation, price, capacity, age, startTime, cutoff, gpxUrl.
- `RaceRegistration` – id, userId, raceEventId, raceCategoryId, bib, status, payment fields, emergency contact, club, t-shirt, medical cert, notes. `@@unique([userId, raceCategoryId])`.
- `RaceEditHistory` – id, raceEventId, editorId, action, summary, changes (JSONB), createdAt.
- `AdminAuditLog` – id, actorId, action, targetType, targetId, summary, metadata (JSONB), createdAt.

**Enums:** `UserRole`, `Gender`, `OrganizationStatus`, `OrganizerRole`, `InvitationStatus`, `RaceSource`, `RaceType`, `RaceStatus`, `EventRegistrationStatus`, `RegistrationStatus`, `PaymentStatus`, `PaymentMethod`.

### Migrations

Migration files are under `prisma/migrations/`. Run new migrations with `npm run prisma:migrate` after schema changes.

### Seed

`prisma/seed.ts` creates three demo users, three approved organizations, four races (one `PLATFORM`), and one sample registration.

### Raw SQL Notes

Several newer schema fields and tables are accessed via typed raw SQL in `src/lib/organizer.ts` and `src/lib/admin.ts` because generated-client refresh issues were encountered during the session:

- `OrganizationInvitation` reads/writes.
- `RaceEditHistory` writes and reads.
- `AdminAuditLog` writes and reads.
- Some `Organization.logoUrl` and `rejectionReason` updates.

See `CODEX_CONTEXT.md` for the exact context. Prefer Prisma-generated methods when the generated client is up to date.

---

## Key Domain Helpers

### `src/lib/race-repository.ts`

- `getUpcomingRaceEvents(limit?)`
- `getRaceEventBySlug(slug)`
- `getRaceEventById(id)`
- `findRaceEvents(filters)`

Falls back to mock data from `src/lib/races.ts` when `DATABASE_URL` is unset or the DB errors. Maps Prisma dates to ISO strings.

### `src/lib/races.ts`

- `RACE_TYPE_LABELS`, `EVENT_REGISTRATION_STATUS_LABELS`
- `sampleRaces` (mock fallback)
- `RaceFilters` type + `filterRaces(filters)`
- `getUpcomingRaces`, `getRaceBySlug`, `getRaceById`

### `src/lib/algeria.ts`

- `ALGERIA_WILAYAS` constant (58 wilayas)
- `AlgeriaWilaya` type

### `src/lib/organizer.ts`

- `requireApprovedOrganizer()` – server-side guard.
- `getOrganizerDashboardData(userId)`
- `getOrganizerRaces(organizationId)`
- `getOrganizerRaceById(organizationId, raceEventId)`
- `getOrganizerRaceRegistrations(organizationId, raceEventId)`
- `getOrganizerMembers(organizationId)`
- `getOrganizationProfile(organizationId)`, `updateOrganizationProfile(...)`
- `inviteOrganizationUser(...)`, `acceptOrganizationInvitation(...)`, `getOrganizationInvitationByToken(token)`
- `createOrganizerRace(...)`, `updateOrganizerRace(...)`, `upsertOrganizerRaceCategory(...)`
- `updateOrganizerRaceRegistrationStatus(...)`
- `updateOrganizationMemberRole(...)`, `removeOrganizationMember(...)`
- `recordRaceEditHistory(...)` (raw SQL)
- `OrganizerError` class

### `src/lib/admin.ts`

- `requireAdmin()` – server-side guard.
- `getAdminDashboardStats()` – aggregate counts.
- `createPlatformRace(input)` – superadmin platform race creation.
- `getAdminRaceForEdit(id)`, `updateAdminRace(...)`
- `getAdminAuditLogs()`, `recordAdminAuditLog(...)`
- `getAdminUsers(filters)`, `getAdminOrganizations(filters)`, `getAdminRaces(filters)`, `getAdminRegistrations(filters)`
- `getAdminRaceEditHistory(raceEventId)`
- `AdminError` class

### `src/lib/organizations.ts`

- `createOrganizationRequestForUser(userId, input)`
- `getUserOrganizationSummary(userId)`
- `OrganizationRequestError`

### `src/lib/registrations.ts`

- `createRaceRegistrationForUser({ userId, raceEventId, input })`
- `getUserRegistrations(userId)`
- `RegistrationError`

### `src/lib/storage.ts`

- `saveImageUpload(file, scope)` – local filesystem only.
- Scopes: `avatar`, `race`, `organization`.
- Max 5 MB; accepts JPG/PNG/WebP/GIF.
- Writes to `public/uploads/<scope>/<YYYY-MM>/<uuid>.<ext>`.
- Returns public URL `/uploads/...`.
- `UploadError` class.
- Environment variable checked: `UPLOAD_STORAGE_DRIVER` (if set and not `local`, throws).

### `src/lib/validations.ts`

All Zod schemas in one place: `loginSchema`, `registerUserSchema`, `updateProfileSchema`, `organizationRequestSchema`, `organizationProfileSchema`, `organizationInviteSchema`, `organizerRaceSchema`, `organizerRaceUpdateSchema`, `organizerCategorySchema`, `platformRaceSchema`, `adminRaceUpdateSchema`, `createRaceSchema`, `raceRegistrationSchema`, plus `localUploadPathSchema` / `imageUrlSchema`.

### `src/lib/format.ts`

- `formatDate`, `formatDateTime`, `formatDzd`, `formatDistance`

### `src/lib/i18n.ts`

- `LOCALES = ["en", "fr", "ar"]`
- `dictionaries` with nested `nav`/`home`/`races`/`search`/`common` keys
- `getLocale`, `getDictionary`, `withLocale`

---

## Route Handlers & Server Actions

### API Route Handlers (`src/app/api/.../route.ts`)

- `GET /api/races` – list/filter published races (`findRaceEvents`).
- `POST /api/races` – validation placeholder (returns draft mock, does not persist).
- `GET /api/races/[id]` – race by id.
- `PATCH /api/races/[id]` – placeholder.
- `DELETE /api/races/[id]` – placeholder.
- `POST /api/races/[id]/register` – authenticated registration.
- `GET /api/races/[id]/categories` – categories list.
- `POST /api/uploads` – authenticated image upload, scope-checked.
- `GET /api/me/registrations` – current user registrations.
- `GET /api/organizer/events` – list org races.
- `POST /api/organizer/events` – create race.
- `GET /api/organizer/events/[id]/registrations` – participant list.
- `GET /api/organizer/events/[id]/registrations/export` – CSV export.
- `GET /api/admin/organizations` – admin org list.
- `PATCH /api/admin/organizations/[id]/approve` – approve org + promote members.
- `PATCH /api/admin/organizations/[id]/reject` – reject org.
- `GET /api/admin/races` – admin race list.
- `PATCH /api/admin/races/[id]/approve` – publish race.
- `PATCH /api/admin/races/[id]/reject` – reject race.
- `src/app/api/auth/[...nextauth]/route.ts` – Auth.js handlers.

### Server Actions (`src/app/**/actions.ts`)

Key actions by file:

- `src/app/login/actions.ts` – `loginAction`
- `src/app/register/actions.ts` – `registerAction`
- `src/app/account/profile/actions.ts` – `updateProfileAction`
- `src/app/races/[slug]/register/actions.ts` – `registerForRaceAction`
- `src/app/organizer/request/actions.ts` – `requestOrganizationAction`
- `src/app/organizer/settings/actions.ts` – `updateOrganizationSettingsAction`
- `src/app/organizer/members/actions.ts` – `inviteMemberAction`, `updateMemberRoleAction`, `removeMemberAction`
- `src/app/organizer/events/[id]/actions.ts` – `updateRegistrationStatusAction`
- `src/app/organizer/events/[id]/edit/actions.ts` – `updateOrganizerRaceAction`, `upsertOrganizerCategoryAction`
- `src/app/organizer/events/new/actions.ts` – `createOrganizerRaceAction`
- `src/app/admin/actions.ts` – `approveOrganizationAction`, `rejectOrganizationAction`, `approveRaceAction`, `rejectRaceAction`, `unpublishRaceAction`, `updateUserRoleAction`
- `src/app/admin/races/[id]/edit/actions.ts` – `updateAdminRaceAction`
- `src/app/admin/races/new/actions.ts` – `createPlatformRaceAction`
- `src/app/invite/[token]/actions.ts` – `acceptInviteAction`

### Patterns

- Every protected handler/action calls `auth()` or domain guards (`requireAdmin`, `requireApprovedOrganizer`).
- Zod validation before DB operations.
- Custom error classes mapped to HTTP status codes / form errors.
- `revalidatePath` used after admin/organizer mutations.
- Server actions accept `FormData` and use local helpers like `getFormId`, `getFormString`, `getOptionalFormString`.
- Route handlers use Next.js 15 async `params` pattern.

---

## UI Conventions

### Layout Components

- `SiteHeader` (server) – fetches user from DB, passes to `SiteHeaderClient`.
- `SiteHeaderClient` (client) – nav, theme/lang switchers, account menu or login button.
- `AccountMenu` (client) – dropdown with outside-click, Escape, close-on-route-change, and client-side `signOut` from `next-auth/react`.
- `DashboardShell` (client) – responsive admin/organizer nav shell with mobile top tabs and desktop left nav.
- `ThemeSwitcher` (client) – light/dark/race toggle; persists `racedz-theme` in `localStorage`.
- `LanguageSwitcher` (client) – `en`/`fr`/`ar` via `?lang=` query param.

### Forms & Race UI

- `ImageUploadField` – uploads via `POST /api/uploads`, optimistic preview, 5 MB client-side validation, scope-aware.
- `RaceCard` – race listing card.
- `RaceSearchForm` – filter form.
- `Button` / `ButtonLink` – variants `primary`/`secondary`/`outline`/`ghost`; sizes `sm`/`md`/`lg`.
- `Badge` – default/teal/orange/green/red/blue.

### Theming

- CSS variables in `src/app/globals.css`.
- Three modes: `light`, `dark`, `race`.
- Race mode uses lime green (`#39ff14`), hot pink (`#ff2bd6`), and purple (`#9b5cff`) while preserving readability.
- Tailwind brand colors: `brand.teal` (`#0F766E`), `brand.tealDark` (`#115E59`), `brand.orange` (`#F97316`), `brand.orangeDark` (`#EA580C`), `brand.charcoal` (`#111827`), `brand.muted` (`#6B7280`).
- Inline script in `RootLayout` prevents theme flash by reading `localStorage` early.

### Languages

- Supported locales: `en`, `fr`, `ar`.
- `withLocale(href, locale)` appends `?lang=<locale>` for non-English links.
- Arabic RTL polish is partial; keep bilingual-readiness in mind for new UI.

### Design Direction

- Mobile-first, clean, minimalist, sporty.
- Public race discovery: energetic, clear race status, date, location, distance, price, registration action.
- Dashboards: quiet, dense, operational tables, filters, status badges, clear actions.
- Avoid generic SaaS/landing-page filler.

---

## File Uploads & Storage

MVP uploads are local only. Future S3 migration should happen behind `src/lib/storage.ts`.

- Allowed scopes: `avatar`, `race`, `organization`.
- Allowed types: JPEG, PNG, WebP, GIF.
- Max size: 5 MB.
- Stored at `public/uploads/<scope>/<YYYY-MM>/<uuid>.<ext>`.
- Public URL returned as `/uploads/<scope>/<YYYY-MM>/<uuid>.<ext>`.
- Scope access:
  - `avatar` – any authenticated user.
  - `race` / `organization` – requires `ORGANIZER`, `ADMIN`, or `SUPERADMIN`.
- `public/uploads/*` is gitignored except `public/uploads/.gitkeep`.

---

## Security Considerations

Treat OWASP Top 10 practices as baseline:

- **Authentication:** Auth.js JWT sessions with `AUTH_SECRET`. Passwords hashed with bcrypt (10 rounds). No password reset or social login yet.
- **Authorization:** Middleware provides coarse route guards; server actions and route handlers re-check roles; domain helpers (`requireAdmin`, `requireApprovedOrganizer`) enforce fine-grained access.
- **Role safeguards:**
  - Only `ADMIN`/`SUPERADMIN` can access `/admin`.
  - Only approved organizers can manage organization-owned races.
  - `updateUserRoleAction` prevents self-role-change and protects the last superadmin.
  - Organization member management has owner-lockout protections.
- **Validation:** Zod schemas for every form/request body in `src/lib/validations.ts`.
- **Safe redirects:** `getSafeCallbackUrl` rejects non-path and protocol-relative URLs; `canUseCallbackForRole` restricts `/admin` and `/organizer` callbacks to appropriate roles.
- **Upload security:** Authenticated endpoint, scope check, MIME-type whitelist, size limit, UUID filename, stored outside source control.
- **Data exposure:** Use narrow `select` clauses, aggregate/count queries for dashboards, and pagination for lists.
- **Audit logging:** `AdminAuditLog` records admin approve/reject/unpublish, race edits, and user role changes. `RaceEditHistory` records organizer race/category edits with before/after JSONB changes.
- **Secrets:** Keep `.env`, uploads, and generated files out of Git.
- **Rate limiting / security headers / CSP:** Not implemented yet; defer until production-readiness work.

---

## Performance & Quality Guidelines

- Use pagination for admin and public lists.
- Use `count` and aggregate queries for dashboard stats.
- Select only fields needed by each page/API.
- Avoid loading full tables for dashboards.
- Add indexes/migrations when filters become hot paths.
- Run `npm run lint`, `npm run typecheck`, and `npm run build` after meaningful code changes.

---

## Current Limitations & Technical Debt

- **Raw SQL** is used for some newer tables/fields due to Prisma client refresh issues during the session; migrate to generated Prisma methods once the client is refreshed.
- **No real payment gateway** – only manual `paymentStatus`/`paymentMethod` fields.
- **No email delivery** – invitations are copy-link only.
- **No marketplace / bib transfer** – intentionally deferred until transfer, fraud, organizer approval, and payment rules are specified.
- **No rate limiting** on auth or upload endpoints.
- **No automated tests**.
- **No security headers / CSP** configured; `next.config.ts` is empty.
- Public race API `POST/PATCH/DELETE` for `/api/races/[id]` are placeholders that do not persist.
- Local upload storage only; S3 wiring is stubbed.
- No centralized error logging / monitoring.
- Registration flow decrements `availablePlaces` but does not handle refunds/cancellations restoring capacity.
- No password reset or social login.

---

## Environment Variables

Required / available in `.env.example`:

```env
DATABASE_URL="postgresql://racedz:racedz@localhost:5432/racedz"
AUTH_SECRET="change-me"
AUTH_URL="http://127.0.0.1:3003"
NEXTAUTH_SECRET="change-me"
NEXTAUTH_URL="http://127.0.0.1:3003"

NEXT_PUBLIC_APP_NAME="RaceDZ"
NEXT_PUBLIC_APP_TAGLINE="Find, register, and manage races across Algeria."

UPLOAD_PROVIDER="local"

# Future S3
AWS_REGION=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
S3_BUCKET_NAME=""

# Future email
EMAIL_PROVIDER=""
EMAIL_FROM=""
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
```

Auth.js v5 uses `AUTH_SECRET` and `AUTH_URL`. Legacy `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are kept for compatibility. Public env vars must use the `NEXT_PUBLIC_` prefix.

---

## Quick Reference: Files to Read Before Changes

1. `TODO.md` – source of truth for priorities.
2. `CODEX_CONTEXT.md` – architecture notes and raw-SQL context.
3. `prisma/schema.prisma` – data model.
4. `src/auth.ts`, `middleware.ts`, `src/lib/permissions.ts` – auth/authz.
5. `src/lib/validations.ts` – all input schemas.
6. `src/lib/organizer.ts`, `src/lib/admin.ts`, `src/lib/registrations.ts` – domain logic.
7. `src/lib/race-repository.ts`, `src/lib/races.ts` – public race reads.
8. `src/lib/storage.ts` – upload boundary.
9. `src/components/layout/dashboard-shell.tsx` – dashboard navigation.
10. `src/app/globals.css`, `tailwind.config.ts` – theming.

---

## Agent Working Rules

- Read `TODO.md` and `CODEX_CONTEXT.md` first, then use targeted reads for the specific feature instead of loading broad unrelated files.
- Do not repeatedly reread large files unless they changed or the task depends on exact text.
- Keep progress updates concise and only include what affects the current implementation.
- Prefer implementing the next concrete task over restating long plans.
- Use the existing Next.js App Router structure.
- Prefer typed helpers in `src/lib` over duplicating domain logic in pages.
- Prefer server-side authorization and shared domain helpers for protected workflows.
- Keep public UI mobile-first and bilingual-ready.
- For every UI change, apply 2026-ready product UI best practices: clean minimalist layout, strong visual hierarchy, accessible controls, and runner-focused flashes of energetic color.
- Maintain the three visual modes: light, dark, and race.
- Use Zod for request validation.
- Enforce role checks on the server for every protected page, route handler, and server action.
- Do not add payment gateway integration yet; keep manual payment status fields.
- Do not build registration resale/marketplace yet.
