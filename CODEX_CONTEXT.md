# Codex Context: RaceDZ

## Goal

Build RaceDZ, a full-stack Next.js MVP for Algerian running events. The product lets runners discover and register for races, organizers manage events and participants, and admins approve organizations/events.

## Source Of Truth

- Planning and implementation roadmap: `TODO.md`
- Historical full brief: `algeria-races-codex-brief.md`
- Brand asset: `public/racedz-logo.png`
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
- Local PostgreSQL can run with `docker compose up -d postgres`.
- `OrganizationInvitation` exists in `prisma/schema.prisma` and its migration. The current app code uses typed raw SQL for that table in `src/lib/organizer.ts` because local `prisma generate` was not refreshing the generated client during this session.

## MVP Priorities

Read `TODO.md` first. Current priorities are organizer onboarding, organizer race management, and admin/superadmin dashboard work.

## Brand

- Name: RaceDZ
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
