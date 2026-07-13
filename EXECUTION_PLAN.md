# ZidRun — Consolidated Execution Plan (verified)

**One source of truth for what's actually left to do.** Every item below was checked against the
codebase on **2026-07-13**; anything already implemented was removed (see "Verified DONE — removed"
at the bottom for what was dropped and why). Only **MISSING** or **PARTIAL** work remains here.

Legend: 🔴 blocker before production · 🟠 launch sprint · 🟡 scale/after-launch · 🟢 later
Effort: S = <½ day · M = ~1–2 days · L = ~3–5 days · XL = 1–3 weeks
Status: ❌ missing · ◐ partial (scope narrowed to the gap)

### Progress log
- **2026-07-13 — P0 pass.** Shipped: Google-link account-takeover fix, invite-accept rate limit +
  off-topic coach DB-bloat cap, `server-only` provider guards, past-race→COMPLETED cron, and **opt-in
  TOTP two-factor** (RFC-6238-tested lib, `/account/security` enrollment, login two-step, migration
  `20260713120000_add_user_mfa`). IDOR and secrets/PII audits both came back **CLEAN**. All changes pass
  typecheck / lint / build / `test:mfa`. **Owner follow-ups:** `npx prisma migrate deploy`; schedule the
  new cron; runtime click-through of MFA. **Still open in P0:** major-version dependency upgrade for the
  5 high vulns (needs a tested pass), MFA enforcement flip for `/admin/*`, external review, owner ops.

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
- [ ] *(optional)* Image **re-encode** on upload — uploads validate type/size/magic-bytes + sanitize
      filenames already; re-encoding (strip EXIF/parser exploits via sharp) is the only missing layer. — S

### Data integrity / ops
- [x] ✅ **Mark past races COMPLETED** — DONE: `src/lib/race-lifecycle.ts` `completePastRaces()` + cron route
      `POST /api/internal/cron/complete-past-races` (CRON_SECRET-guarded, idempotent). **Owner: schedule it
      daily** alongside the other `internal/cron/*` jobs.
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

- [ ] ❌ **Private profile toggle** — no profile-wide privacy control (User has no `isPublic`/`visibility`
      field; profile form has none). Per-run `isPublic` exists, but not a "make my profile private" setting.
      Add the field + form control + honor it in social/public views. — M
- [ ] ◐ **Notification i18n** — `User.locale` field **exists** but `src/lib/notifications.ts` is entirely
      English-only for every recipient (race/approval/announcement/registration titles/bodies/subjects).
      Read recipient `User.locale` and thread it into every `notify*` builder. — M
- [ ] ◐ **Shirt option** — captured at registration (`RaceRegistration.tshirtSize`) but (a) sizes stop at XXL,
      add **3XL**; (b) **no race-side config** — organizers can't enable a shirt or define offered sizes; the
      selector always shows. Add a shirt config on the race/category + gate the field on it. — M
- [ ] ❌ **Photo verification at registration** — no such feature anywhere. Let organizers require/upload a
      race photo to be checked at registration. *(needs a short spec)* — L
- [ ] **Races sort control** *(decision, then S)* — "Upcoming only" default is DONE; backend sort
      (date/distance/price) exists but **no UI selector**. Backlog said "remove sort"; UI audit said "add sort".
      **Decide:** expose a sort dropdown in `race-search-form.tsx`, or leave soonest-first only. — S
- [ ] ❌ **i18n key-parity check** — no script/CI enforcing en/fr/ar key parity in `i18n.ts` + `coach/copy.ts`
      (all three locales exist but nothing guards drift). Add a tiny parity script, wire into `lint`/CI. — S
- [ ] **Notifications auto-mark-read** *(product decision)* — opening the bell still POSTs read-all
      (`site-header-client.tsx:317–337`). Decide mark-on-click vs an explicit "Mark all read", then implement. — S
- [ ] **Remaining UI polish** (UI_AUDIT P3 + cross-cutting sweeps A–F: focus-visible rings, 44px targets,
      RTL icon mirroring, physical→logical props, gray-400 contrast, menu-behavior consolidation) and
      UI_TODO homepage/race-detail/listing polish. *(P1/P2 audit items already fixed)* — L
- [ ] ◐ **CI pipeline** — the pieces exist as separate npm scripts (`lint`/`typecheck`/`build`/`smoke`) but
      nothing chains them against a started server, and there's no `.github/` workflow. Add one command +
      a CI workflow. — M
- [ ] ◐ **Playwright organizer/admin journeys** — auth + coach e2e exist with fixtures; **add positive
      organizer (create→manage) and admin (approve) browser journeys** + a seed/reset fixture command. — M

---

## P2 — Growth & depth 🟡

- [ ] ❌ **Follow / kudos / result notifications** — Tier-1 models (`Follow`, `RunKudos`, `RaceResult`) exist
      and the actions work, but **no notification is sent** on follow, kudos, or a saved race result. Wire
      `createNotification` into `social.ts` / `organizer.ts` result-upsert. — M
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
- [ ] **Coach richer onboarding** (PLAN_2026 WS2) — history/volume/injury/chronic-condition profile + Zod +
      multi-step form + condition-aware safety gating + plan personalization. **Needs a health-data
      privacy/consent/retention policy line first.** — XL
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
