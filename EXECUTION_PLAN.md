# ZidRun — Consolidated Execution Plan (verified)

**One source of truth for what's actually left to do.** Every item below was checked against the
codebase on **2026-07-13**; anything already implemented was removed (see "Verified DONE — removed"
at the bottom for what was dropped and why). Only **MISSING** or **PARTIAL** work remains here.

## 📊 Overall progress — 19 / 46 items · **41%** _(checkbox count, 2026-07-14)_

`██████████░░░░░░░░░░░░░░░░` **41%**

| Tier | Bar | Done | Left | Total | % |
|---|---|---:|---:|---:|---:|
| 🔴 **P0** — production hardening | `██████░░░░` | 10 | 6 | 16 | 63% |
| 🟠 **P1** — launch UX & product | `███████░░░` | 7 | 3 | 10 | 70% |
| 🟡 **P2** — growth & depth (incl. scale/infra) | `█░░░░░░░░░` | 2 | 13 | 15 | 13% |
| 🟢 **P3** — later | `░░░░░░░░░░` | 0 | 5 | 5 | 0% |
| **Overall** | `████░░░░░░` | **19** | **27** | **46** | **41%** |

> Of the **27 remaining**, ~5 are **owner/external** ops, not dev work — OpenAI billing, Caddy reload,
> `google-services.json`, and the two external reviews (security + sports-health). The other ~22 are
> development items. **Nearest to launch:** P0 (6 left — of which only the **dependency upgrade** is dev
> work; the rest are owner ops) then P1 (3 left). _Note: the social-post race importer (Phase 1) was a
> net-new feature, not a plan item, so it isn't in this count — see the progress log below._

Legend: 🔴 blocker before production · 🟠 launch sprint · 🟡 scale/after-launch · 🟢 later
Effort: S = <½ day · M = ~1–2 days · L = ~3–5 days · XL = 1–3 weeks
Status: ❌ missing · ◐ partial (scope narrowed to the gap)

### Progress log
- **2026-07-14 — Social-post race importer (Phase 1). ✅ 100% of scoped items done.** Shipped on branch
  `feat/social-post-race-import` (typecheck / lint / build all clean; migration applied locally). Admin
  **"Import from post"** flow: a superadmin uploads the Instagram/Facebook poster image(s) and/or pastes
  the caption, an **OpenAI vision** model extracts the race fields, and a **DRAFT** race is created and
  opened in the existing edit page (review banner) to review + publish. Delivered items — all ✅:
  1. ✅ **Provenance schema + migration** (`20260714120000_add_race_import_provenance`): `importSource`,
     `importSourceUrl`, `importRawText`, `importExtractionJson` on `RaceEvent`.
  2. ✅ **Vision extraction** (`src/lib/social-import/extract.ts`) — Responses API + `zodTextFormat`,
     FR/AR/dialect-aware, `SOCIAL_IMPORT_MODEL` env (multimodal; defaults to the coach family).
  3. ✅ **Normalization** (`normalize.ts`) — wilaya-snap to `src/lib/algeria.ts`, distance→raceType, date
     parsing, always-valid DRAFT.
  4. ✅ **Draft create** (`create.ts`) — `status: DRAFT`, `source: PLATFORM`, categories + provenance.
  5. ✅ **Admin UI** (`/admin/races/import`, superadmin-only) + races-list entry point + `?imported=1`
     review banner on the edit page; rate-limited, path-traversal-guarded image reads.
  6. ✅ **Roadmap doc** `SOCIAL_IMPORT_PLAN.md` (Phase 2 = PWA/Android **Share Target**; 3–4 later).
  **Decisions locked:** OpenAI provider · DRAFT status · images+caption ingestion · Instagram + Facebook.
  **Owner follow-up (not part of this scope):** the live extraction call is untested until `OPENAI_API_KEY`
  billing is enabled (already an open ops item below); then run one real post through it.
- **2026-07-13 — P0 pass.** Shipped: Google-link account-takeover fix, invite-accept rate limit +
  off-topic coach DB-bloat cap, `server-only` provider guards, past-race→COMPLETED cron, and **opt-in
  TOTP two-factor** (RFC-6238-tested lib, `/account/security` enrollment, login two-step, migration
  `20260713120000_add_user_mfa`). IDOR and secrets/PII audits both came back **CLEAN**. All changes pass
  typecheck / lint / build / `test:mfa`. **Owner follow-ups:** `npx prisma migrate deploy`; schedule the
  new cron; runtime click-through of MFA. **Still open in P0:** major-version dependency upgrade for the
  5 high vulns (needs a tested pass), MFA enforcement flip for `/admin/*`, external review, owner ops.
- **2026-07-14 — Product + perf + mobile session.** Shipped (all typecheck/lint/build-verified, on `main`):
  admin↔runner **support chat** (`SupportThread`/`SupportMessage` + migration `add_support_chat`; runner chat, admin
  inbox with name/email search, two-way in-app/push notifications); **first-login onboarding** (skippable
  `/account/welcome` + AI-coach invite, `User.onboardedAt`); **cross-device language/theme** (`User.language`/`theme`,
  applied on new-device login); trilingual **FAQ** page; **legal rewrite** — Terms (fulfillment/refund/warranty/
  liability, Algiers law) + Privacy incl. a cookie policy, EN/FR/AR — plus a first-visit **cookie-consent banner**
  (analytics honor a reject; banner hidden in-app); **blocked-user enforcement** on live sessions (`/blocked` +
  forced sign-out); **admin login → `/admin`** redirect fix; demo-login removed; admin user detail now shows
  target/#runs/#AI-prompts; coach trial-countdown + subscribe CTA; coach-subscription link in the mobile account hub.
  **Mobile:** animated bouncing-Z boot splash. **Perf:** public race reads cached in Next's data cache with tag
  invalidation on every mutation; server-only legal/FAQ text split into `src/lib/i18n-content.ts`, shrinking the
  shared client chunk **48→25 KB gzipped**. **Follow-ups → new items below:** deploy the two new migrations;
  consolidate the two middleware files; commit the still-uncommitted i18n split.

---

## P0 — Production hardening (before public launch) 🔴

### Security
- [x] ✅ **Google-linking account takeover** — FIXED `src/auth.ts`: nulls `passwordHash` (force reset)
      when Google sign-in first-verifies an account that carried a credentials password. Credentials login
      already denies a null hash (`auth.ts:77`).
- [x] ✅ **Rate-limiting gaps** — FIXED: invite-accept now throttled (`invite/[token]/actions.ts`,
      10/10min per user); off-topic coach BLOCKED rows capped at 30/user/day (`coach/service.ts`).
- [x] ✅ **TOTP two-factor (opt-in)** — SHIPPED: self-contained TOTP (`src/lib/mfa.ts`, RFC-6238-tested
      via `npm run test:mfa`) + recovery codes; enrollment at `/account/security`; login two-step prompt
      (`login-form.tsx` + `loginAction`); authoritative gate in `authorize`. Migration
      `20260713120000_add_user_mfa`. **Still open:** flip to *enforced-for-admins* later (currently any user
      may opt in; `/admin/*` is not yet forced). — done
- [x] ✅ **IDOR / authz sweep** — CLEAN. No cross-tenant IDOR; coach raw SQL is userId-scoped, org actions
      org-scoped, admin gated. One **LOW** to consider: org `MEMBER` role can edit races / confirm payments /
      export participant PII (only membership, not OWNER/ADMIN, is checked) — decide if MEMBER should be
      view-only. Confined to the user's own org (not an IDOR).
- [x] ✅ **Secrets/PII audit** — CLEAN. No secret via `NEXT_PUBLIC_`, no PII in responses/logs. Added
      `server-only` guards to email/firebase providers. **MED (owner/ops):** coach payment-proof files live
      under `public/uploads/coach-payment/*`; confidentiality relies on Caddy 403 + the Next port not being
      directly reachable — keep the app port internal-only.
- [ ] **Dependency upgrade for high vulns** — `npm audit`: 5 high / 24 moderate. Runtime-relevant highs
      (`next`, `next-auth`, `@sentry/nextjs`) need **major-version** bumps — do a scoped, tested upgrade,
      NOT a blind `npm audit fix --force`. Others (`tar`, `rollup`, `@capacitor/cli`, `next-mdx-remote`) are
      build-time/transitive or author-controlled-content, lower runtime risk. **Node is already v20** (EOL-18
      concern moot in this env). — M
- [ ] **External security review** before public launch. — (external)
- [x] ✅ *(optional)* Image **re-encode** on upload — DONE 2026-07-14 (`src/lib/storage.ts`). Every accepted
      image is decoded + re-encoded through **sharp** before it's written, which strips all metadata (EXIF GPS,
      camera info, embedded thumbnails/ICC) and collapses malformed/polyglot files that pass the magic-byte
      sniff — the stored bytes come from our encoder, not the untrusted input. `.rotate()` bakes EXIF
      orientation into the pixels first so photos stay right-side-up; animated GIFs re-encode frame-by-frame;
      a decode failure surfaces as a normal `UploadError`; reported size reflects the re-encoded bytes.
      *Verified:* a JPEG carrying EXIF GPS + orientation 6 comes out with no EXIF and the rotation baked in
      (64x32 → 32x64), and a JPEG-magic/HTML polyglot is rejected. — S
- [x] ✅ **Consolidate the two middleware files** — FIXED 2026-07-14. Confirmed the root `middleware.ts` never ran
      (Next shadows it with `src/middleware.ts` when a `src/` dir is present) — so the auth guard was dead and, worse,
      its `@/auth` import was **edge-unsafe** (`@/auth` pulls in `server-only` + Prisma via `auth-credentials.ts`),
      so a naive merge would have broken the edge build. Applied the canonical next-auth v5 split: new edge-safe
      `src/auth.config.ts` (JWT session strategy + pages + the pure `session` callback) is shared by `src/auth.ts`
      (which adds the DB-touching providers + signIn/jwt callbacks) and `src/middleware.ts` (which builds an edge
      `NextAuth(authConfig)` just to decode the JWT). `src/middleware.ts` now does **both** the auth guard (private
      `/account|/organizer|/admin` areas, all methods) and locale persistence; root `middleware.ts` deleted. This
      **restores** the previously-dead auth-guard redirect (defense-in-depth on top of the page/`layout` checks).
      Typecheck + build clean (Middleware bundles at 144 kB, no server-only/Prisma leak into edge). — S

### Data integrity / ops
- [x] ✅ **Mark past races COMPLETED** — DONE: `src/lib/race-lifecycle.ts` `completePastRaces()` + cron route
      `POST /api/internal/cron/complete-past-races` (CRON_SECRET-guarded, idempotent). **Owner: schedule it
      daily** alongside the other `internal/cron/*` jobs.
- [x] ✅ **Deploy the 2026-07-14 migrations** *(owner)* — DONE (owner-confirmed 2026-07-14). `add_support_chat`
      and `add_onboarding_and_appearance_prefs` (incl. the onboarding backfill that treats existing users as
      onboarded) are deployed. Local `prisma migrate status`: 42 migrations, schema up to date.
- [x] ✅ **Commit the perf i18n split** *(dev)* — DONE. `src/lib/i18n-content.ts` + the `terms/privacy/faq`
      pages are committed (`7bdcf99`); nothing left uncommitted.
- [ ] **Android push + Crashlytics** *(owner)* — ship `android/app/google-services.json`, rebuild APK, get
      users on it, **then** set `NEXT_PUBLIC_NATIVE_PUSH_ENABLED=true` + server `FIREBASE_*`. Same file lights
      up the already-wired Crashlytics.
- [ ] **Caddy reload after deploy** *(owner)* — bind-mounted `Caddyfile` (403s `/uploads/coach-payment/*`)
      isn't auto-reloaded by `up -d`; run `caddy reload` after `./deploy.sh`.
- [ ] **OpenAI billing** *(owner)* — key returns `insufficient_quota`; enable billing + spend cap + budget
      alert, rerun live provider test.
- [ ] **Sports-health professional review** of coach safety rules. — (external)

---

## P1 — Launch-blocking UX & product gaps 🟠

### Progress log
- **2026-07-13 — P1 pass.** Shipped: i18n parity gate, private profile, per-item notification read, CI
  workflow, shirt 3XL + full organizer shirt config. Decisions: races-sort → keep soonest-first only;
  notifications → per-item read. All pass typecheck/lint(+parity)/build.

- [x] ✅ **Private profile toggle** — `User.profilePrivate` opt-in in profile settings; honored in
      leaderboards, activity feed, and follow. Migration `20260713130000_add_profile_privacy`.
- [x] ✅ **Shirt option** — 3XL added; organizer per-race enable (all 4 create/edit forms); registration
      selector gated on `race.shirtEnabled`; shirt totals-by-size on the organizer registrations page.
      Migration `20260713140000_add_race_shirt`.
- [x] ✅ **Notifications mark-read** — bell no longer marks-all-on-open; per-item read on click
      (`POST /api/notifications/[id]/read`) + "Mark all read" button + unread dots.
- [x] ✅ **i18n key-parity check** — `scripts/check-i18n-parity.ts`, fails `npm run lint` on en/fr/ar drift.
- [x] ✅ **CI pipeline** — `.github/workflows/ci.yml`: postgres service, lint+typecheck+unit tests+build+smoke.
- [x] ✅ **Races sort** — decided: keep soonest-first only (no UI selector). Resolved.
- [x] ✅ **Notification i18n** — FIXED 2026-07-14. The recipient locale field is actually `User.language`
      (not `User.locale`). New `src/lib/notifications/messages.ts` catalog holds en/fr/ar copy for every
      fixed-string builder; `src/lib/notifications.ts` now threads each recipient's `language` → locale and
      localizes title/body/subject + email chrome (button + meta labels) **per recipient** — `notifyRecipients`
      was reworked to take a `localize(locale)` callback so a fan-out to recipients with different languages
      each get their own translated copy. Email templates receive `locale` too, so Arabic emails render RTL.
      Recipient queries now select `language`; single-recipient builders resolve it via `getUserLocale()`.
      Free-text pieces (organizer announcements, support-chat previews, the change summary) are passed through
      untranslated by design. Typecheck + lint (changed files) + i18n parity all clean; localized output
      spot-checked at runtime. **Out of scope (unchanged):** admin-authored broadcasts and coach reminders
      (the latter already localize via `preferredLocale`). — M
- [ ] ❌ **Photo verification at registration** — no such feature. Let organizers require/upload a race photo
      to be checked at registration. *(needs a short spec)* — L
- [ ] **Remaining UI polish** (UI_AUDIT P3 + cross-cutting sweeps A–F) and UI_TODO homepage/race-detail/
      listing polish. — L
- [ ] ◐ **Playwright organizer/admin journeys** — auth + coach e2e exist; add positive organizer
      (create→manage) and admin (approve) browser journeys + a seed/reset fixture command. — M

---

## P2 — Growth & depth 🟡

- [x] ✅ **Follow / kudos / result notifications** — DONE 2026-07-14. Three new types (`SOCIAL_FOLLOW`,
      `SOCIAL_KUDOS`, `RACE_RESULT_PUBLISHED`) wired into `social.ts` (`toggleFollow`/`toggleKudos`) and
      `organizer.ts` (`saveOrganizerRaceResult`), each localized en/fr/ar via the notification message catalog
      and delivered **in-app + push only** (per-event email would be noisy — same call as the support-message
      alerts). All three are user-toggleable via `notificationPreferenceOptions`. Guards: only the *on*
      transition notifies (unfollow / un-kudos are silent), never self-notify (own-run kudos, organizer
      recording their own result), and an **unchanged** result re-save doesn't re-notify (a corrected time
      does). Notifications are best-effort — the follow/kudos/result row is already committed, so a
      notification failure is logged, not surfaced as a failed action.
      *Verified end-to-end against a real DB:* 10/10 checks incl. an `ar` recipient receiving genuinely Arabic
      copy and the actor receiving nothing. — M
- [ ] ❌ **In-app share-my-run/plan card** — only a "share publicly" flag exists; no shareable artifact.
      Build an OG/`ImageResponse` share card (route/distance/pace/"planned by Coach Zid"). Highest-leverage
      growth item per marketing. — M
- [ ] ❌ **Reverse trial / free allowance** — trial is already **7 days** (`COACH_TRIAL_DAYS`, env-overridable).
      After it ends access is hard-blocked (tier `NONE`, 0/0). Marketing wants a small post-trial free
      allowance (~5 actions/mo) instead of a hard wall — add a reverse-trial tier. — M
- [ ] ❌ **GDPR self-service deletion** — only admin-initiated deletion exists, yet the privacy policy already
      *claims* self-deletion (`i18n-content.ts:156`). Build a runner "delete my account + coach data" purge
      (goals, runs+GPS, sleep logs, payment-proof files). **Promote to P0 if launching in an EU-data context.** — M
- [ ] **Trial-ending lifecycle nudge** *(dev+marketing)* — in-app + push/email "2 days left," subscribe prompt
      after a PB/great run. — M
- [ ] **Coach context personalization hardening** — the richer onboarding fields are now present, but
      the context still needs actual-plan adherence, confirmed long-term memory, target-race/timezone
      realism, privacy-safe location enrichment, reproducible context versions, and stronger outcome
      evaluation. Execute the prioritized checklist in
      [`docs/COACH_CONTEXT_EXECUTION_TODO.md`](docs/COACH_CONTEXT_EXECUTION_TODO.md). **P0 first:**
      data contract/consent, prompt-injection tests, actual plan state + adherence, and context audit
      fixtures. — XL
- [ ] **Notifications polish** — improve branded email template further; payment-proof review notifications;
      race reminder jobs. — M
- [ ] **Mobile — remaining PWA/Capacitor** — logo/SVG, manifest (`manifest.ts`), and the icon set are DONE.
      Remaining: offline shell + FCM SW coexistence + mobile viewport/safe-area/tap-target audit (Phase A),
      then Capacitor native bridges + store submission (Phase B/C). — XL
- [ ] **Analytics key-action events** *(optional)* — page-view analytics + Sentry are DONE; there's no discrete
      key-action/conversion event table. Add if funnel analysis needs it. — M
- [ ] **Public runner profile page**; **clubs / running groups** (Tier-1 deferrals). — L
- [ ] **Blog** — registered-runner comments (`BlogComment` + moderation); remaining posts (mental training,
      cross-training, nutrition timing, foot types, recovery) EN+FR+AR. — L

### Scale / infrastructure — ~1000 concurrent (do in order, before the next big race)
Context: run recording is **client-side** (one `POST /api/coach/runs` at run-end + offline retry, not a live
stream), so raw throughput isn't the risk. The real bottleneck is the **registration thundering-herd** on
registration-open, and the single-host stack (one app container + local-volume uploads) that can't scale out.
Target ~€40/mo on Hetzner (CPX41 + object storage), no AWS needed at this size.
- [x] ✅ **(1) Make the registration transaction atomic** — DONE (`src/lib/registrations.ts`). The
      count-then-insert race is closed **without** a new counter column (which would drift against the
      cancel-path `increment` and the CANCELLED/REJECTED-excluding count): the category cap now takes a
      `SELECT … FOR UPDATE` row lock on the `RaceCategory` before its `count()`, serializing concurrent
      registrations for the same distance; the event `availablePlaces` countdown became a single atomic
      guarded `updateMany (WHERE availablePlaces > 0)` that can't go negative. Proven with a real-Postgres
      thundering-herd test — `npm run test:registration` (`scripts/test-registration-concurrency.ts`): 40
      concurrent registrations against a CAP-5 race yield exactly 5, and removing the lock overshoots to 17.
      **Still optional:** front the registration-open moment with a Cloudflare waiting room for extra smoothing. — M
- [ ] ❌ **(2) Externalize uploads to R2** — uploads currently write to a **local** Docker volume
      (`racedz_uploads`, `src/lib/storage.ts`), which pins the app to one host. Move to Cloudflare R2 / Hetzner
      Object Storage (S3 API) so the app tier becomes stateless and horizontally scalable. (Note: P3 already lists
      "S3 upload migration" — this is the same work, promoted.) — M
- [ ] ❌ **(3) PgBouncer + 3–4 app replicas on a CPX41** — bump to a Hetzner CPX41 (8 vCPU/16GB), run 3–4 `app`
      replicas behind Caddy/LB, and put **PgBouncer** in front of Postgres so replicas don't exhaust
      `max_connections` (default 100). Requires (2) done first. After this, "add a node" is a ~5-min op. — M
- [ ] ❌ **(4) Load-test before the next big race** — use the existing `loadtest/k6` harness to simulate the
      registration thundering-herd against the real endpoint and validate the atomic fix + replica setup under
      ~1000 concurrent. — S

---

## P3 — Later 🟢
- [ ] Marketplace for running goods (admin-approved) — full spec in `TODO.md`.
- [ ] Bib transfer / registration resale — pending fraud/payment/approval rules.
- [ ] Strava / wearable sync (needs registered app + secrets); FIT import (binary decoder).
- [ ] Coach/AI-authored custom workout structures; mid-step pace enforcement; persist guided run across kill.
- [ ] Password reset UX polish; social login beyond Google; exportable admin audit reports; S3 upload
      migration; web/JS error dashboard (GlitchTip self-host).

---

## Recommended sprint sequence

| Sprint | Focus | Items |
|---|---|---|
| **1** | 🔴 Security | Google-link fix, invite-accept rate limit + coach-BLOCKED counting, admin MFA, IDOR sweep, secrets audit, npm audit/Node upgrade |
| **2** | 🔴 Ops + integrity | Owner: google-services.json + Caddy + OpenAI billing; mark-past-COMPLETED job; upload re-encode (optional) |
| **3** | 🟠 Product gaps | Private profile toggle, notification i18n (`User.locale` wiring), shirt config + 3XL, races-sort decision |
| **4** | 🟠 Quality + UI | i18n parity check, CI pipeline, organizer/admin Playwright, notif mark-read decision, UI cross-cutting sweeps |
| **5** | 🟡 Growth | Follow/kudos/result notifications, share card, reverse trial, lifecycle nudge, GDPR self-delete |
| **6+** | 🟡 Depth | Coach onboarding (WS2), notifications polish, PWA/Capacitor, blog, public profile/clubs |
| **Later** | 🟢 | Marketplace, bib transfer, Strava, etc. |

Run **marketing P0** (`marketing/03-marketing-todo.md`) in parallel from day 1.

---

## Open decisions blocking work
- **Races sort**: expose a sort dropdown, or keep soonest-first only? (backlog vs UI-audit conflict)
- **Coach health data**: comfortable storing chronic-condition/medication data? Policy line needed before WS2.
- **GDPR deletion**: is launch EU-data-facing? If yes, self-delete → P0.
- **Mobile**: confirm Capacitor wrapper (RN rewrite ≈ 8–14 wks, not recommended).
- **Logo/brand**: current mark is inline SVG; any further design work → hire a designer?
- **Coach persona** (marketing): real ambassador vs AI avatar vs hybrid — blocks all coach video.

---

## Verified DONE — removed from the plan (checked 2026-07-13)
These were in the earlier plan but the code already implements them, so they were dropped:

- **Security headers** (CSP/HSTS/X-Frame/X-Content-Type/Referrer/Permissions) — `next.config.ts`.
- **Android `allowBackup="false"`** — `AndroidManifest.xml`.
- **Upload hardening** — type/size/magic-byte validation + UUID filenames + auth'd payment-proof serving
  (`src/lib/storage.ts`). *(only image re-encode absent — kept as optional P0.)*
- **Admin dark-mode row-hover** — theme-remapped in `globals.css:159–194`.
- **Confirm dialogs on destructive actions** — `ConfirmSubmit` used across admin/organizer cancel/delete/block.
- **Resend-verification 120s countdown** — `src/app/login/resend-verification.tsx`.
- **Admin user management** — delete/block/verify + status (verified, first/last login) in `admin/users/[id]`.
- **Google profile picture on signup** — `getOAuthPicture` stored as `avatarUrl` in `src/auth.ts`.
- **Auto-hide past races + "show past" opt-in** — `race-repository.ts` / `show-past-toggle.tsx`
  *(only the COMPLETED status write is missing — kept as a small P0 item).*
- **Coach answers in the user's language** — `preferredLocale` threaded through context/output/plan;
  user-changeable in coach settings.
- **Emergency contact + club name at registration** — `RaceRegistration` fields + form + validation.
- **Usage analytics + error reporting** — first-party `PageView` + admin dashboard + Sentry.
- **Branded email template** — `src/lib/notifications/email-template.ts`.
- **Logo → inline SVG + PWA manifest + full icon set** — `racedz-logo.tsx`, `manifest.ts`, `public/` icons.
- **7-day coach trial** — `COACH_TRIAL_DAYS = 7` *(reverse-trial allowance still missing — kept in P2).*
