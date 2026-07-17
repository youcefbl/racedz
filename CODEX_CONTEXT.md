# Codex Context: ZidRun

## Goal

Build ZidRun, a full-stack Next.js MVP for Algerian running events. The product lets runners discover and register for races, organizers manage events and participants, and admins approve organizations/events.

## Source Of Truth

- Planning and implementation roadmap: `TODO.md`
- Historical full brief: `algeria-races-codex-brief.md`
- Brand assets: `public/brand/` for logo and mark exports; root-level `public/icon-*` files are generated PWA/app icons.
- AWS deployment plan and cost estimate: `docs/AWS_DEPLOYMENT_PLAN.md`
- Prisma schema: `prisma/schema.prisma`
- Seed data: `prisma/seed.ts`

`backlog.md` and `requirment.md` are intentionally only pointers now. Do not use them for planning.

## Current Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Zod for validation
- Auth.js / NextAuth credentials auth

## Architecture Notes

- Public pages live under `src/app`.
- API routes are Next route handlers under `src/app/api`.
- Race reads go through `src/lib/race-repository.ts`, using Prisma when `DATABASE_URL` is available and mock fallback otherwise.
- Reusable labels, mock fallback race data, and filters are in `src/lib/races.ts`.
- Algeria constants are in `src/lib/algeria.ts`.
- Authorization helpers start in `src/lib/permissions.ts`.
- Local image uploads go through `src/lib/storage.ts` and write to `public/uploads` for the MVP. Uploaded files are gitignored except `public/uploads/.gitkeep`. Keep the storage helper as the boundary for a later S3-compatible backend.
- Notification records go through `src/lib/notifications.ts`. The MVP stores in-app notifications in PostgreSQL, shows recent notifications from the header bell dropdown, marks them read on dropdown open, sends transactional email through Resend using `RESEND_API_KEY` and `EMAIL_FROM`, and has Firebase FCM server delivery plus browser token registration via `PushNotificationControl`. The notification settings page can reconnect the FCM token and send a test push with delivery feedback. Local push testing requires Firebase public web config and `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- Branded email HTML/text lives in `src/lib/notifications/email-template.ts`; use it for every ZidRun email instead of ad hoc HTML.
- New accounts require email verification. Verification tokens use raw SQL helpers in `src/lib/email-verification.ts`; Auth.js blocks unverified accounts.
- Organization invites are still copyable in `/organizer/members`, but the invite action also attempts branded email delivery with the invite link.
- Race announcements use `RaceAnnouncement` and `src/lib/announcements.ts`. Organizer/admin announcements notify active registrants and appear on public race detail pages.
- Runner AI coach backend lives under `src/lib/coach`. PostgreSQL owns coach memory; recent runs and aggregate metrics are assembled into compact context for the OpenAI Responses API. Deterministic planning and safety code controls dates, workout types, and distance limits before AI output is saved. Coach APIs live under `src/app/api/coach`.
- Runner coach UI lives at `/account/coach` and in `src/components/coach`. `npm run test:e2e:coach` checks the authenticated workflow and provider-failure persistence; set `RACEDZ_REQUIRE_LIVE_AI=1` to require a successful paid OpenAI response.
- Coach persistence currently uses typed parameterized raw SQL in `src/lib/coach/service.ts` because the local Prisma 5.21 generator exits successfully without refreshing its generated client. `prisma/schema.prisma` and migration `20260621013000_runner_ai_coach` remain authoritative; migrate the service to generated delegates when client generation is repaired.
- Admin audit logs support actor, target type, and action filters in `/admin/audit`.
- Manual QA checklist lives in `docs/QA_CHECKLIST.md`. `npm run smoke` runs dependency-free local smoke checks against `RACEDZ_BASE_URL` or `http://127.0.0.1:3003`; keep `npm run dev` running first.
- Local development uses one fixed app URL: `http://127.0.0.1:3003`. Do not rotate ports; Auth.js redirects are configured for this origin.
- Local PostgreSQL can run with `docker compose up -d postgres`.
- `OrganizationInvitation` exists in `prisma/schema.prisma` and its migration. The current app code uses typed raw SQL for that table in `src/lib/organizer.ts` because local `prisma generate` was not refreshing the generated client during this session.
- `RaceEditHistory` stores organizer race/category changes. History writes use raw SQL in `src/lib/organizer.ts`, and superadmin reads use raw SQL in `src/lib/admin.ts`.
- AI coach server configuration uses `OPENAI_API_KEY`, optional `OPENAI_COACH_MODEL`, `COACH_DAILY_AI_LIMIT`, and `COACH_MONTHLY_AI_LIMIT`. Never expose the OpenAI key through a `NEXT_PUBLIC_` variable.

## MVP Priorities

Read `TODO.md` first. Current priorities are organizer onboarding, organizer race management, and admin/superadmin dashboard work.

## Brand

- Name: ZidRun
- Tagline: Find, register, and manage races across Algeria.
- Primary: `#0F766E`
- Accent: `#F97316`
- UI: clean, sporty, trustworthy, mobile-first.

## UI Direction

For any UI work, apply modern 2026 web product best practices by default:

- Start from a clean, minimalist interface with strong hierarchy, generous spacing, and fast scanning.
- Use energetic runner-focused color accents, especially orange/red/lime/teal, but keep the base calm and readable.
- Prefer real product/content surfaces over marketing filler.
- Make race status, date, location, distance, price, and registration action immediately visible.
- Design mobile-first, then enhance desktop density.
- Use clear iconography, accessible contrast, visible focus states, and large tappable controls.
- Keep dashboards quiet and operational; keep public race discovery more energetic.
- Support three theme modes from the app header: light, dark, and race.
- Race mode should stay readable but intentionally flashy, with running/event energy from lime green, hot pink, and purple accents.
- If a UI choice is ambiguous, choose the most usable minimalist option and document the decision. Ask the user only when the choice changes product behavior or brand direction.
