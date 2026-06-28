# ZidRun — AI Working Context (token-lean)

Read THIS first each session. Deep dives: `TODO.md` (backend/product), `UI_TODO.md` (UI/UX),
`CODEX_CONTEXT.md` (architecture), `docs/AI_COACH_MVP_PLAN.md` (coach). Don't re-read those unless a task needs them.

## What ZidRun is
MVP platform to discover/publish/register for running races in Algeria. Runners browse+register+log
runs+follow AI coach plans. Organizers publish races+manage participants. Admins approve orgs/races.

## Stack
Next.js 15 App Router · React 19 · TS · Tailwind 3 · Prisma 5 + PostgreSQL · Zod · Auth.js v5 (credentials + Google) · OpenAI Responses API (`gpt-5.4-mini`). Local dev URL fixed: `http://127.0.0.1:3003`. DB: `docker compose up -d postgres`.

## Commands
`npm run dev` · `lint` · `typecheck` · `build` · `smoke` (needs dev running) · `test:coach` · `test:e2e:coach` · `prisma:generate|migrate|seed`. Quality gate before commit: lint + typecheck + build.

## Repo map (only what matters)
- Pages: `src/app/**` (38 page.tsx). Public `/`, `/races`, `/races/[slug]`, `/organizers`. Auth `/login` `/register`. Runner `/account/*` (+ `/account/coach`). Org `/organizer/*`. Admin `/admin/*`.
- API route handlers: `src/app/api/**`. Coach APIs: `src/app/api/coach/**`.
- Domain libs: `src/lib/` — `race-repository.ts` (Prisma+mock fallback), `races.ts`, `algeria.ts`, `permissions.ts`, `admin.ts`, `organizer.ts`, `registrations.ts`, `notifications.ts`, `validations.ts`, `i18n.ts`, `storage.ts`.
- Coach engine: `src/lib/coach/` — `metrics.ts` `planning.ts` `safety.ts` `context.ts` `openai.ts` `schemas.ts` `service.ts` `http.ts`.
- Coach UI: `src/components/coach/` — dashboard, goal-form, plan/runs panels, conversation, `copy.ts` (i18n strings), `types.ts`.
- Layout/UI: `src/components/layout/` (header, account-menu, theme-switcher, `racedz-logo.tsx`), `src/components/ui/` (button…), `src/components/races/race-card.tsx`.

## i18n (KEY for translation work)
- `src/lib/i18n.ts` (~492 lines): `LOCALES = en|fr|ar`, `dictionaries.{en,fr,ar}` (~154 keys each, must stay in sync), `getLocale`, `getDictionary`, `withLocale`. Coach has its own strings in `src/components/coach/copy.ts`.
- Locale passed via query string today; persistence beyond query string is a known gap. Arabic = RTL (partial polish).
- Admin pages intentionally English-only for now.

## Theming
Three modes: light · dark · race (lime/pink/purple flashy). CSS vars: `var(--surface)`, `var(--border)`, `var(--text-strong)`, `text-brand-teal`. Brand: primary teal `#0F766E`, accent orange `#F97316`. Every UI change must be checked in all 3 modes + mobile + RTL.

## AI coach — current state (the feature to extend)
Backend + runner UI shipped. Onboarding goal fields TODAY (`src/lib/coach/schemas.ts` + `coach-goal-form.tsx`):
goalType (GENERAL_FITNESS|5K|10K|HALF|MARATHON|TRAIL|OTHER), targetDate, targetDistanceKm, targetTimeSeconds,
experienceLevel (BEGINNER|INTERMEDIATE|ADVANCED), currentWeeklyDistanceKm, availableTrainingDays[], preferredLongRunDay, constraints, injuryNotes, preferredLocale.
Context sent to model (`context.ts`): goal, experience, availability, current plan+completion, last 5–10 runs, 4–8wk aggregate metrics, fatigue/pain flags, language. PII never sent.
Safety (`safety.ts`): danger-signal detection EN/FR/AR; deterministic dates/types/distance caps; model only explains, never invents metrics. Per-user daily+monthly AI limits. Cost ≈ $0.0054/response.
DB note: coach + a few tables use raw parameterized SQL because local Prisma 5.21 generator didn't refresh the client — schema + migration `20260621013000_runner_ai_coach` are authoritative.

## Mobile readiness
No Capacitor/Expo/RN, no PWA manifest yet. `public/firebase-messaging-sw.js` exists (FCM push). App is SSR/server-action heavy — wrapping the existing web app (Capacitor) is the low-cost path vs. a native/RN rewrite.

## Conventions
Match surrounding code style. Server-side authz on every protected route/action. Zod-validate all inputs. Keep OpenAI key server-only (never `NEXT_PUBLIC_`). Uploads go through `storage.ts` (local now, S3 later). Use the branded email template `src/lib/notifications/email-template.ts`. Mobile-first; dashboards calm/dense, public discovery energetic.

## Three active workstreams (see PLAN_2026.md)
1. UI/UX + logo + full FR/AR translation coverage + RTL polish.
2. AI coach: richer onboarding (runner history, volume, targets, injury history, chronic conditions) → better per-user context.
3. Turn the web app into Android + iOS apps.
