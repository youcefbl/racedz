# ZidRun — UI Audit Backlog

Impeccable-style UI critique run **2026-06-29** across the whole app: the deterministic
detector (Assessment B) plus 5 parallel design-review passes (Assessment A) over
public/discovery, auth+account, coach, organizer+admin, and shell+primitives+email.

**This is a backlog to address later.** Tackle by priority; the cross-cutting section
batches one-fix-many-file items.

> ## ✅ Status — 2026-06-29: all P1 + P2 fixed except one deferred P2 (tsc 0 errors · lint 0 errors · detector clean)
>
> - **P1 (all 3):** filled-orange contrast → dark ink on the Button, notification badge, and email CTA + dark-theme dark-ink overrides in `globals.css`; register password hint reconciled to 8 chars (en/fr/ar); coach goal wizard now validates (`targetTime` format + numeric ranges, `parseDurationToSeconds` returns `null` not `NaN`, all steps validated before POST).
> - **P2 (all):** theme-aware skeletons; notifications no longer auto-mark-read is *not yet done — see note*; RTL directional-icon mirroring (pagination, native-header back, nav chevron, organizers CTA, coach overview arrow); login/register divider contrast; notification-settings save confirmation (`?saved=1` banner); register live password-match; removed the redundant "WELCOME BACK" eyebrow; home hero slimmed to keyword-only (`hideFilters`) + de-duplicated panel title; differentiated the coach feature list from organizers; organizer registrations RTL search props; event publication panel (one primary + red-ghost confirmed Cancel); admin coach policy moved to a collapsible; organizer edit form sectioned; coach hydration flash + chat loading placement; focus-visible + 44px targets on coach raw controls, race-type cards, rankings tabs.
> - **Still open:** everything under **P3** below, plus the remainder of the cross-cutting sweeps (Button `outline`/`ghost` focus ring, Button `size=sm`/native-header 44px, rankings/audit `gray-400`, menu-behavior consolidation) and the **notifications auto-mark-read-on-open** behavior change (deferred — needs a product call on mark-on-click vs an explicit control).

## Scorecard (Nielsen heuristics /40)

| Area | Score | Band |
|---|---|---|
| Auth + account | 34/40 | Good |
| Public / discovery | 33/40 | Good |
| Coach app | 32/40 | Good |
| Organizer + admin | 34/40 | Good |
| Shell + primitives + email | 29/40 | Good (dragged by the contrast + skeleton bugs) |
| **Average** | **~32/40** | **Good** |

**AI-slop verdict (all areas): PASSES.** No gradient text, no side-stripe borders, no
per-section uppercase eyebrows, no 01/02/03 scaffolding. The only mild tells: the
identical 4-up feature-card grid shared verbatim by `/organizers` and `/coach`, the
`SectionPage` kicker on every static page, and two thin decorative brand gradient bars
(header + email — purposeful, aria-hidden).

**Detector: 6 `gray-on-color` hits — all confirmed FALSE POSITIVES** (theme-remapped or
disabled/other-ternary-branch): `admin/registrations:163`, `coach-goal-form:321/364`,
`coach-motivation:41`, `coach-plan-panel:87`, `account-menu:150`. No action needed.

---

## P1 — Major (fix first)

- [ ] **White-on-orange fails WCAG AA (~2.75:1)** — the primary `Button` filled variant, the notification count badge, and the transactional **email CTA** all use white text on brand-orange `#F47A20`. `src/components/ui/button.tsx:6`, `src/components/layout/site-header-client.tsx:~350`, `src/lib/notifications/email-template.ts` (button td). *Why:* the app's and email's most important actions are hard to read; breaks the "AA across all themes" baseline. *Fix:* filled CTAs → brand-teal `#15803D` (white-on-teal ~5:1, already the header's choice), or a darker orange; reserve orange for borders/accents/text-on-light (`brand-orangeText`).
- [ ] **Register password hint contradicts validation (tri-lingual)** — hint says "at least 6 characters" but the field is `minLength={8}`. `src/app/register/register-form.tsx:46` + i18n `passwordHint` (en/fr/ar). *Why:* a 7-char password is told it's fine, then blocked — a broken error-prevention loop in all 3 locales. *Fix:* pick one rule (align hint, `minLength`, `confirmPassword`, and the server action).
- [ ] **Coach goal wizard has no real validation** — the multi-step goal form is a `<section>` of `type="button"` controls (no `<form>`), so every `min/max/required/pattern` is decorative; `targetTime="abc"` → `NaN` and out-of-range distance/RHR/weight POST to the coach API. `src/components/coach/coach-goal-form.tsx` (~147, 164, 223-230). *Why:* malformed data reaches the API/DB. *Fix:* wrap steps in a real `<form onSubmit>` or extend `validateStep()` to cover `targetTime` format + numeric ranges before `submit()`.

## P2 — Important

**Shell / primitives**
- [ ] **Skeletons flash bright in dark/race** — `Skeleton` uses `bg-gray-200`, which is NOT in the theme remap (only `hover:bg-gray-200` is), so loaders render a bright `#e5e7eb` block on dark/neon. `src/components/ui/skeleton.tsx:6`. *Fix:* `bg-[var(--surface-muted)]`, or add base `.bg-gray-200` to the remap in `globals.css` (and fix the file's "theme-aware" comment).
- [ ] **Notifications auto-mark-all-read on open** — opening the bell immediately POSTs read-all, zeroing every unread marker with no triage. `src/components/layout/site-header-client.tsx:~314`. *Fix:* mark read on item click, or add an explicit "Mark all read" control; don't clear on open.
- [ ] **Directional icons don't mirror in RTL** — `ChevronLeft/Right`, `ChevronsLeft/Right` in `Pagination`, the native-header back arrow, and the drawer nav chevron keep their LTR direction under `dir="rtl"`. `src/components/ui/pagination.tsx:59/64`, `native-header.tsx`, `site-header-client.tsx:~254`. *Fix:* a `[dir="rtl"] .rtl-flip{transform:scaleX(-1)}` utility on directional glyphs (see Cross-cutting C).

**Auth / account**
- [ ] **Divider "or" / "or use email" contrast fail** — `text-gray-400` (~2.5:1) on white, real meaningful text. `src/app/login/page.tsx:144`, `src/app/register/page.tsx:73`. *Fix:* `text-gray-500`.
- [ ] **notification-settings save has no confirmation** — server action fires with zero success feedback. `src/app/account/notification-settings/page.tsx:~80`. *Fix:* `useActionState` success message with `role=status`/aria-live (mirror profile-form).
- [ ] **Register: no live password-match feedback** — mismatch only surfaces after a submit round-trip. `register-form.tsx:63`. *Fix:* onBlur match check.
- [ ] **Redundant second uppercase eyebrow on the login card** — "WELCOME BACK" above "Sign in" (the hero already has one). `login/page.tsx:127`. *Fix:* drop it (register card proves it's unnecessary).

**Public / discovery**
- [ ] **Duplicate hero title on home** — the branded panel prints `home.title`, the exact same string as the `<h1>`. `src/app/page.tsx:68`. *Fix:* give the panel its own copy (next-race teaser / stat / value prop) or drop the text.
- [ ] **Home hero = wall of options** — full `RaceSearchForm` (keyword + 4 filter selects) + two large CTAs ≈ 7 targets at the primary decision point; "Find a race" duplicates the search box. `page.tsx:47`, `race-search-form.tsx`. *Fix:* keyword+submit only on home (filters live on `/races`), or drop the redundant CTA.
- [ ] **Identical feature-card grids** — byte-identical 4-up `border bg-white p-5` icon+h3+p grid on `/organizers:76` and `/coach:74`. *Fix:* differentiate one (editorial 2-col list, or vary emphasis/size).
- [ ] **Missing `rtl:rotate-180` on organizers CTA arrow** — `src/app/organizers/page.tsx:56` (every other arrow flips). *Fix:* add it.

**Coach**
- [ ] **Hydration mismatch on motivation tip** — `useState(() => Math.random()…)` runs on SSR and client → mismatch + tip flash. `coach-motivation.tsx:95`. *Fix:* init to 0, randomize in `useEffect`.
- [ ] **Chat loading/answer at opposite ends** — log is newest-first but the "Coach is reviewing…" indicator is appended at the bottom and there's no scroll-to-newest. `coach-conversation.tsx:127/138`. *Fix:* put the indicator where the new message lands (top), or render oldest-first + auto-scroll.
- [ ] **Coach overview arrow not flipped in RTL** — `coach-overview.tsx:47` (see Cross-cutting C).
- [ ] **Goal-form "Background" step is a wall of ~10 inputs** — only weekly distance is required but the optional majority isn't de-emphasized. `coach-goal-form.tsx:235-303`. *Fix:* split essential vs a collapsible "Optional details".

**Organizer / admin**
- [ ] **Organizer registrations search breaks RTL** — physical `left-3` / `pl-9 pr-3` on a localized page. `organizer/events/[id]/registrations/page.tsx:75,80`. *Fix:* logical `start-3` / `ps-9 pe-3` (then sweep other organizer inputs — Cross-cutting D).
- [ ] **Event publication panel: button wall + unguarded destructive action** — 4 equal-weight status buttons; "Cancel registration" is race-wide, not styled red, and has NO confirm. `organizer/events/[id]/page.tsx:161-190`. *Fix:* collapse the 3 states into a segmented/select control; make Cancel ghost+red wrapped in the existing `ConfirmSubmit`.
- [ ] **Admin coach page: policy wall in the subtitle** — full pricing/trial rules crammed into the `AdminShell` description. `admin/coach/page.tsx:40`. *Fix:* one-line subtitle + a compact collapsible info panel.
- [ ] **Organizer edit form ungrouped** — ~18 fields in one flat 2-col grid while the create form is nicely sectioned. `organizer/events/[id]/edit/event-edit-form.tsx:53-131`. *Fix:* reuse the create form's `<section>` + icon-title grouping.

## P3 — Polish

- [ ] Error toasts use `role="status"` (polite) + auto-dismiss with no hover pause. `ui/toast.tsx:35/28` → `role="alert"`/`aria-live="assertive"` for error, pause timer on hover/focus.
- [ ] `Button` `outline`/`ghost` have no `focus-visible` ring color → fall back to default blue. `ui/button.tsx:8-9` → add `focus-visible:ring-brand-teal`.
- [ ] Native chrome weights exceed the 600 cap (`native-header-title` 900, tab label 800, badges 900). `globals.css:439/366/484` → lower to ≤600 or document as a deliberate exception.
- [ ] Native-header controls under 44px (back 36, action 40). `globals.css:445/469` → 44×44.
- [ ] `SectionPage` kicker above every static page (about/terms/privacy/contact). `section-page.tsx:13` → drop or vary cadence.
- [ ] Account-hub theme picker flashes "light" selected for one paint before localStorage corrects. `account-hub.tsx:190` → read `data-theme` off `<html>` for initial state.
- [ ] Google button uses a plain "G", not the branded multicolor logo. `auth/google-sign-in-button.tsx:82` → inline the official SVG.
- [ ] Payment panel reuses `underReview` copy for both the standing state and the post-submit success. `account/registrations/payment-panel.tsx:88,93` → distinct "Proof submitted" success string.
- [ ] Races list uses a bespoke dashed empty state instead of the shared `EmptyState`. `races/page.tsx:74-92`.
- [ ] Races list has no sort control (`race-sort-select.tsx` does not exist) and no pagination. `races/page.tsx` → add sort (date/price/distance) + paging as volume grows.
- [ ] Rankings rank numerals `text-gray-400` on white (~2.8:1). `rankings/page.tsx:124` → `text-gray-500/600`.
- [ ] Rankings hardcoded English ("Runner", "km", "/km", "R") bypass i18n; `TabLink` ~30px < 44px. `rankings/page.tsx:129/135/171/86` (admin-gated, lower urgency).
- [ ] Race detail: bordered inner rows nested inside bordered cards (announcements/categories). `races/[slug]/page.tsx:180,199` → `divide-y` or drop outer border.
- [ ] Race-search keyword input has no explicit placeholder color. `race-search-form.tsx:100` → `placeholder:text-gray-500`.
- [ ] Coach goal-form uppercase `font-black` pill eyebrow above the setup H1. `coach-goal-form.tsx:195` → plain colored label (match dashboard header).
- [ ] Coach chat empty state reuses `noReview` ("No coach review yet.") — reads as a dead end. `coach-conversation.tsx:123` → chat-specific "Ask your first question below".
- [ ] Plan generation (multi-second AI) shows only a button-label change. `coach-plan-panel.tsx:49` → spinner + skeleton row.
- [ ] Recording/Transcribing status not in an aria-live region. `coach-conversation.tsx:197-198` → `aria-live="polite"`.
- [ ] Weekly progressbar aria-label is just "This week". `coach-overview.tsx:69` → "Weekly distance progress" + `aria-valuetext`.
- [ ] Admin dashboard: 7 near-identical StatCards incl. 3 that differ only by time window. `admin/page.tsx:23-34` → collapse the 3 race-created cards into one with today/week/year sub-figures.
- [ ] Admin coach StatCards pack two large numbers into one `text-3xl` (overflow risk at 375px). `admin/coach/page.tsx:46,51` → `text-xl` or split.
- [ ] Audit "Target: {id}" in `text-gray-400` on white (real content). `admin/audit/page.tsx:114` → `text-gray-500/600`.
- [ ] `QueueCard` value in a fixed `size-12` box (4-digit overflow). `admin/page.tsx:78` → `min-w-12 px-2`.

## Cross-cutting patterns (one fix, many files)

- [ ] **A — `focus-visible` rings on raw `<button>`/`<a>`**: race-type cards (`page.tsx:119-131`), rankings tabs (`rankings:81-90`), coach chips/toggles/tabs (`coach-conversation`, `coach-motivation`, `coach-runs-panel`, `coach-dashboard:193`), and Button `outline`/`ghost`. Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal`.
- [ ] **B — 44px touch targets**: coach suggestion chips / "Another tip" / public-private toggle (~28-30px), Button `size="sm"` (`h-9`) used for row/card actions, native-header controls, rankings tab. Raise to `min-h-11`/`h-10`+ on touch.
- [ ] **C — RTL directional-icon mirroring**: add a `.rtl-flip` utility and apply to pagination chevrons, native-header back, drawer nav chevron, organizers CTA arrow, coach overview arrow.
- [ ] **D — physical → logical props sweep**: organizer registrations search (`left-3`/`pl-9`) and any other `ml-/mr-/left-/right-/pl-/pr-` on localized surfaces → `ms-/me-/start-/ps-/pe-`.
- [ ] **E — `text-gray-400`-on-white contrast**: login/register divider, rankings ranks, audit target id → `text-gray-500/600`.
- [ ] **F — consolidate menu behavior**: AccountMenu / NotificationDropdown / SettingsMenu / Language / Theme switchers each re-implement outside-click + Escape instead of the shared `useMenuKeyboard`; the notification panel uses `role="menu"` over non-focusable `<div role="menuitem">` (roving focus can't land). Consolidate on the hook; use a `feed`/list semantic for the rich notification items.

---

## Top 10 highest-leverage fixes

1. Fix white-on-orange contrast (Button + notification badge + email CTA) — one root cause, the most important actions. **[P1]**
2. Reconcile the register password 6-vs-8 hint/validation contradiction. **[P1]**
3. Make the coach goal wizard actually validate (real `<form>` / `validateStep`). **[P1]**
4. Theme-aware skeletons (kills bright loading flashes in dark/race). **[P2]**
5. Stop auto-marking notifications read on open. **[P2]**
6. `focus-visible` ring sweep across raw buttons/anchors (Cross-cutting A). **[P2]**
7. RTL directional-icon mirroring (Cross-cutting C) + organizer RTL search props (D). **[P2]**
8. Kill the duplicate home-hero title and slim the hero to keyword + one CTA. **[P2]**
9. Differentiate the organizers ↔ coach feature grids (last real slop tell). **[P2]**
10. 44px touch-target sweep (Cross-cutting B) + gray-400 contrast sweep (E). **[P2/P3]**

## What's genuinely strong (keep)

Real RTL (logical props, pre-hydration `dir`), consolidated header (Settings popover),
optimistic-with-rollback + failure toasts, two-step sign-out confirm, aria-live error
regions + labeled password toggles, per-item confirm dialogs, semantic `<dl>` on
about/contact, and a technically careful email (bulletproof MSO button, preheader,
`dir="auto"`, dark-mode). The design system is cohesive — most findings are polish, not breakage.
