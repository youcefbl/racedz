# ZidRun — Tier 1 Feature Build (Retention & Community)

Tracking the first-tier feature gaps identified in the product review. Tier 1 targets the
biggest hole: **there is little reason to open the app between races.** These features close
loops that are already half-built and add the retention/community layer.

Legend: ✅ done · 🚧 in progress · ⏳ queued · ⏭️ deferred

---

## 1. Community / social

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1.1 | Un-hide per-wilaya leaderboards (public) | ✅ | Removed admin gate in `src/app/rankings/page.tsx`; added public nav link in `site-header-client.tsx`. |
| 1.2 | Follow + activity feed + kudos | ✅ | Models `Follow` + `RunKudos`; `src/lib/social.ts`; `/api/social/{follow,kudos,feed}`; `/account/feed` screen; follow buttons on leaderboards; feed + leaderboard links in account hub. |
| 1.3 | Clubs / running groups | ⏭️ | Deferred to a later pass — larger surface, reuses `Organization`. |

## 2. Gamification — ✅ COMPLETE

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 2.1 | Personal Records (5K / 10K / longest / best pace) | ✅ | `src/lib/coach/records.ts` (pure compute) + `records-summary.tsx` card on the Runs screen. |
| 2.2 | Streaks (consecutive active weeks) | ✅ | Weekly streak (current + longest) in `records.ts`, shown as the headline number on the records card. |
| 2.3 | Badges / achievements | ✅ | `src/lib/coach/badges.ts` (compute-on-read: volume/distance/consistency/racing) + `badges-strip.tsx` on the Runs screen. No migration — derived from records + race finishes. |

## 3. Race results (close the race loop)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 3.1 | Finish-time / result capture (organizer) | ✅ | Model `RaceResult`; `saveOrganizerRaceResult` + `saveRaceResultAction`; inline result column (time + status) on the organizer registrations table. Helpers in `src/lib/race-results.ts`. |
| 3.2 | Runner finisher history ("My races") | ✅ | `getUserRegistrations` includes the result; finisher banner (time + overall/category rank) on each card in `/account/registrations`. |
| 3.3 | Finisher certificate | ✅ | Print/PDF certificate at `/account/registrations/[id]/certificate` (owner-only, FINISHED results); linked from the finisher banner. `PrintButton` + `getUserRegistrationForCertificate`. |

---

## Build log
- **2026-07-09** — Tier 1 shipped. Leaderboards public; Personal Records + streaks on the Runs screen; follow/feed/kudos social layer; race results (organizer capture + runner finisher history). Migration `20260709120000_add_social_and_race_results` applied. `tsc`, `eslint`, and `next build` all pass.

## Verification
- `npx tsc --noEmit` — clean.
- `npx eslint` on all changed files — clean.
- `npx next build` — success; new routes present (`/account/feed`, `/rankings`, `/api/social/{follow,kudos,feed}`).
- ⚠️ Not yet exercised at runtime in a browser (no manual click-through). Recommend a smoke test: record a public run → appears in `/account/feed` and leaderboard → follow a runner from `/rankings` → kudos a run → organizer saves a finish time → runner sees it in `/account/registrations`.

## New files
- `src/lib/coach/records.ts` — PR/streak computation.
- `src/components/coach/records-summary.tsx` — records card.
- `src/lib/social.ts` — follow graph, feed, kudos.
- `src/components/social/{follow-button,feed-view}.tsx`, `src/app/account/feed/page.tsx`, `src/app/api/social/{follow,kudos,feed}/route.ts`.
- `src/lib/race-results.ts` — finish-time parse/format + status helpers.

## Deferred (next passes)
- 1.3 Clubs/groups · 2.3 Badges/achievements · 3.3 Finisher certificates.
- Notifications on follow/kudos/result (models exist; not yet wired).
- A public runner profile page (follow currently happens from leaderboard/feed rows).
