# ZidRun — End-to-End Test Plan

Full E2E coverage plan for the core user journeys: auth, registration, password
reset, profile completion, AI coach, race search/registration + payment, and the
organizer/admin lifecycle. Complements `docs/E2E_TEST_STRATEGY.md` (high-level) and
`docs/QA_CHECKLIST.md` (manual).

---

## 1. Tooling — what we use and why

**Playwright** (`@playwright/test`, already installed and configured in
`playwright.config.ts`). It's the right tool and it's already wired up:

- **Already in the repo:** config + a working `tests/coach.e2e.spec.ts` with reusable
  patterns (programmatic sign-in, session checks, no-horizontal-overflow, screenshots).
- Drives a real Chromium against the running app (`baseURL` = `http://127.0.0.1:3003`).
- One API for **desktop + mobile viewports**, **RTL/Arabic**, screenshots, traces,
  network interception, and file uploads (needed for the payment-proof flow).
- Generous timeouts already set (`timeout: 120s`, `expect: 45s`) to tolerate the AI calls.

**Supporting layers (keep all three):**

| Layer | Tool | Scope |
|---|---|---|
| Route smoke | `npm run smoke` (`scripts/smoke.ts`) | Fast fetch-only: every public route returns 200 + key copy |
| Coach unit-ish | `npm run test:coach` (`scripts/test-coach.ts`) | Coach domain logic |
| Browser E2E | `npx playwright test` | Full user journeys (this document) |

**Run commands**
```bash
# 1. start app against the test DB on :3003 (separate terminal)
RACEDZ_BASE_URL=http://127.0.0.1:3003 npm run dev

# 2. run the suite
npx playwright test                 # all specs
npx playwright test auth.e2e        # one spec
npx playwright test --headed        # watch it run
npx playwright test --debug         # step through
RACEDZ_REQUIRE_LIVE_AI=1 npx playwright test coach.e2e   # require real OpenAI
npx playwright show-trace test-results/.../trace.zip     # debug a failure
```

---

## 2. Environment & test data

Per `docs/E2E_TEST_STRATEGY.md`:

- **Dedicated test DB** (never local dev data). Reset + migrate + seed before the suite.
- **Seeded deterministic accounts** (`prisma/seed.ts`, password `racedz-demo-password`):
  - `admin@zidrun.com` — SUPERADMIN
  - `organizer@zidrun.com` — ORGANIZER (owns an approved org)
  - `runner@example.com` — verified RUNNER
  - `seeded-user-N@example.com` — bulk runners
  - One published race with an open category; a demo registration.
- **New users** created in tests use **unique emails per run** (e.g. `e2e+<timestamp>@example.com`).
- Demo creds are also surfaced in the UI via the login page's "Demo accounts" panel.

**Reusable helpers** (lift from `coach.e2e.spec.ts` into `tests/helpers.ts`):
- `signInAsDemoRunner(page)` — credentials sign-in via `/api/auth/csrf` + `/api/auth/callback/credentials` (fast, no UI).
- `signInAs(page, email)` — generalize the above for admin/organizer.
- `getSessionEmail(page)` — assert who is logged in via `/api/auth/session`.
- `assertNoHorizontalOverflow(page)` — run on every screen at mobile width.
- `createUserViaUI(page, data)` — full registration journey when UI coverage is the point.

---

## 3. Handling the hard-to-automate bits

| Concern | Approach |
|---|---|
| **Google OAuth** | Don't automate the Google popup. Cover the *UI presence* (button renders, `aria-label`, opens) and use **credentials demo accounts** for all authenticated journeys. Optionally stub the provider. |
| **Email delivery** (verify, reset, notifications) | Don't depend on a real inbox. Read the **token from the DB** (or a captured `email-provider` stub) and hit `/verify-email/[token]` / `/reset-password/[token]` directly. Assert the email *would* send (provider called). |
| **AI non-determinism / cost** | Default: assert the run **persists** and accept either the coaching response **or** the graceful "coach feedback failed" path (as the existing spec does). Gate the paid live-AI assertion behind `RACEDZ_REQUIRE_LIVE_AI=1`. |
| **File upload** (payment proof) | Use Playwright `setInputFiles()` with a small fixture image in `tests/fixtures/`. |
| **Native/Capacitor app** | Out of scope for Playwright (web). Cover the responsive mobile-web layout; track native in a separate device/manual pass. |

---

## 4. Test scenarios

Legend — **Priority**: P0 = critical path (must pass to ship), P1 = important,
P2 = nice-to-have. **(★)** = explicitly requested; **(+)** = added (was missing).

### A. Authentication & account access

#### A1 — Registration: new runner (★) · P0
- **Pre:** logged out.
- **Steps:** `/register` → fill name, email (unique), password (+ show/hide toggle) → submit.
- **Expect:** redirect to `/login?registered=1`; success/verification banner shown; user row exists in DB with `RUNNER` role, unverified.
- **Edges:** duplicate email → inline error, form preserved; weak/short password → validation; mismatched/empty fields → field errors announced (aria-live); password toggle keyboard-reachable.

#### A2 — Email verification + resend (+) · P0
- **Steps:** read verification token from DB → open `/verify-email/[token]`.
- **Expect:** account marked verified; redirect/confirmation; can now log in fully.
- **Edges:** invalid/expired token → clear error, no crash; **resend** from the login banner (`resend-verification.tsx`) → throttle/retry countdown shows, second email queued.

#### A3 — Login (★) · P0
- **Credentials:** `/login` → demo runner → submit → lands on `/account` (role-based redirect: admin→`/admin`, organizer→`/organizer`).
- **Expect:** session cookie set; header swaps to the account menu.
- **Edges:** wrong password → error banner (aria-live), no redirect; unverified user → appropriate message; `?callbackUrl=` honored after login; Google button renders + has accessible label (presence only).

#### A4 — Logout (+) · P0
- **Steps:** account menu → two-step "Confirm sign out" → confirm.
- **Expect:** session cleared; redirect to `/login`; server-rendered header resets (no stale account menu — regression guard for the known bug).

#### A5 — Forgot password → reset (★) · P0
- **Steps:** `/forgot-password` → submit account email → read reset token from DB → `/reset-password/[token]` → set new password → submit.
- **Expect:** redirect to `/login?reset=1` with success banner; old password rejected, new password logs in.
- **Edges:** unknown email → neutral "if it exists" message (no account enumeration); expired/used token → error; weak new password → validation.

#### A6 — Route guards & sessions (+) · P1
- **Steps:** while logged out, visit `/account`, `/account/coach`, `/organizer`, `/admin`.
- **Expect:** redirect to `/login?callbackUrl=...`; after login, land on the original target. Role gates: runner → `/admin` and `/organizer` blocked; organizer → `/admin` blocked.

### B. New-user profile completion (★) · P0
- **Pre:** freshly registered + verified runner, empty profile.
- **Steps:** `/account/profile` → fill identity (first/last, Arabic name, phone, DOB, ID, gender), location (wilaya select, city, commune), avatar upload → save.
- **Expect:** success banner (aria-live); values persist on reload; "(optional)" fields can be left blank and still save.
- **Edges:** required field empty → blocked; very long names wrap; avatar upload accepts image / rejects oversized; wilaya native select works on mobile; RTL when `?lang=ar`.

### C. Race discovery, registration & payment

#### C1 — Search / filter / sort races (★) · P0
- **Steps:** `/races` → keyword search; filter by wilaya, type, distance; sort by date/distance/price; toggle "upcoming only"; mobile **Filters** disclosure.
- **Expect:** list updates (live filtering); URL `?` params reflect state; result count correct; **filtered-to-zero** shows the empty state with a "Clear filters" recovery action; sort default omits the param.
- **Edges:** no results vs no races (distinct empty copy); pagination; RTL filter layout.

#### C2 — Race detail (+) · P1
- **Steps:** open a race card → `/races/[slug]`.
- **Expect:** title, date, location, categories/prices, rules/conditions, registration state (open/closed/full), register CTA gated correctly.

#### C3 — Register for a race (★) · P0
- **Pre:** logged-in runner; published race with an open category.
- **Steps:** race detail → Register → fill runner details + emergency contact + T-shirt + category + accept rules → submit.
- **Expect:** registration created (PENDING); appears in `/account/registrations`; category capacity / already-registered handled; confirmation feedback.
- **Edges:** closed/full race → form disabled with reason; rules unchecked → blocked; already registered for that category → excluded/blocked.

#### C4 — Manual payment: BaridiMob / CCP proof (+) · P0
- **Pre:** a PENDING registration requiring payment.
- **Steps:** `/account/registrations` → payment panel → choose method (BaridiMob/CCP) → **upload proof image** (`setInputFiles`) → submit.
- **Expect:** registration moves to **MANUAL_REVIEW**; proof visible; status badge + payment badge update; runner sees "under review".
- **Edges:** wrong file type/size; re-upload; cancel before submit; state after organizer/admin decision (see E5/F3).

### D. AI Coach (★)

> An automated journey already exists (`tests/coach.e2e.spec.ts`). Extend it into these
> discrete checks. Use the provider-failure-tolerant assertions it demonstrates.

#### D1 — Create running goal (★) · P0
- **Steps:** `/account/coach` → "Create your running goal" → goalType, target distance/time, current weekly distance, availability, long-run day → Create goal.
- **Expect:** overview "Train with a clear next step" renders; no horizontal overflow (desktop + 390px).

#### D2 — Request / generate & accept weekly plan (★) · P0
- **Steps:** Plan tab → "Generate weekly plan" → wait for "Draft plan" → "Accept plan".
- **Expect:** "Active plan" shown; next workout populated. Tolerate AI latency (≤60s) and the documented failure path.

#### D3 — Record a run + coach feedback (★) · P0
- **Steps:** Runs tab → "Log a run" → distance, duration, fatigue, notes → "Save run".
- **Expect:** "Run saved."; run appears in history; coach feedback **or** graceful "coach feedback failed" message. (GPS live-record / route map = manual/device pass.)

#### D4 — Ask the coach (chat) (+) · P1
- **Steps:** ask a question → "Ask coach".
- **Expect:** chat entry appears; aria-live log updates; localized in fr/ar; gate strict live-AI on `RACEDZ_REQUIRE_LIVE_AI=1`.

#### D5 — Coach marketing landing (+) · P1
- **Steps:** top-bar "AI Coach" → `/coach`.
- **Expect:** hero + features + "how it works" + "Free for 1 month" CTA. CTA target: logged-out → `/register`; logged-in → `/account/coach`. Localized en/fr/ar, RTL correct.

### E. Organizer lifecycle (+, mostly) · P0–P1

#### E1 — Request organizer access · P1
- Logged-in runner → `/organizer/request` → submit org details → pending org created; status panel reflects "pending review".

#### E2 — Admin approves organization · P1
- Admin → `/admin/organizations` → approve the pending org → requester upgraded to ORGANIZER.

#### E3 — Create race + categories + image · P0
- Organizer → `/organizer/events/new` → fill details, schedule, location, ≥1 category (add/remove rows), image upload → submit → race PENDING_REVIEW.

#### E4 — Admin publishes race · P0
- Admin → `/admin/races` → approve & publish → race appears on public `/races`.

#### E5 — Manage registrations + confirm payment · P0
- Organizer → `/organizer/events/[id]/registrations` → view entrants, confirm/reject a MANUAL_REVIEW payment, export → runner's status updates accordingly.

#### E6 — Team members invite / accept / revoke (+) · P2
- `/organizer/members` → invite teammate → accept via `/invite/[token]` → revoke. Pending vs accepted states; destructive "revoke" is secondary.

### F. Admin moderation (+) · P1

- **F1 Dashboard/queues** — `/admin` stat cards + the three queue cards link to filtered lists.
- **F2 Users** — `/admin/users` table/cards, role change + save, detail page.
- **F3 Payment review** — `/admin/registrations` confirm/cancel; MANUAL_REVIEW resolution.
- **F4 Race moderation** — `/admin/races` approve/publish/reject/unpublish; history at `/admin/races/[id]/history`.

### G. Notifications (+) · P1
- In-app dropdown: unread count, mark-all-read (optimistic + **rollback on failure** + error toast), open item.
- `/account/notifications` list (read/unread distinction, empty state).
- `/account/notification-settings` email/push toggles persist.
- Triggered emails (registration, payment, approval) render via the shared template.

### H. Invite acceptance (+) · P2
- `/invite/[token]` accept flow for a logged-out vs logged-in user; expired/used token errors.

### I. Rankings (+) · P2
- `/rankings` (admin-gated) wilaya filter **applies** (regression guard for the fixed filter), tabular metrics, empty state.

### J. Cross-cutting (run as matrix over key screens) · P1

- **i18n:** repeat A1/A3/B/C1/C3/D on `?lang=fr` and `?lang=ar`; assert translated labels and **RTL** layout (logical props, flipped arrows, no overflow).
- **Theming:** light / dark / race — no unreadable contrast, brand watermark/Z renders, controls legible.
- **Responsive:** every primary flow at 390×844; `assertNoHorizontalOverflow` everywhere; 44px touch targets.
- **Accessibility:** keyboard-only nav of header menus (roving focus, Esc, return focus), form errors in aria-live regions, focus-visible rings, image alt text. Consider `@axe-core/playwright` for automated a11y assertions.

---

## 5. Suggested spec file layout

```
tests/
  helpers.ts                 # signInAs, getSessionEmail, db token readers, overflow check
  fixtures/proof.png         # payment-proof upload fixture
  auth.e2e.spec.ts           # A1–A6
  profile.e2e.spec.ts        # B
  races.e2e.spec.ts          # C1–C4
  coach.e2e.spec.ts          # D1–D5 (extend existing)
  organizer.e2e.spec.ts      # E1–E6
  admin.e2e.spec.ts          # F1–F4
  notifications.e2e.spec.ts  # G, H
  i18n-rtl.e2e.spec.ts       # J (fr/ar subset)
```

Recommended order to build: **auth → profile → races+payment → coach → organizer/admin
lifecycle → notifications → cross-cutting.** (Auth + the seeded org/race unblock everything else.)

---

## 6. Coverage / priority matrix

| Area | Scenarios | Priority |
|---|---|---|
| Auth (register, verify, login, logout, reset, guards) | A1–A6 | **P0** |
| Profile completion | B | **P0** |
| Race search + register + manual payment | C1–C4 | **P0** |
| AI coach (goal, plan, run, chat, landing) | D1–D5 | **P0/P1** |
| Organizer lifecycle (request→approve→create→publish→manage) | E1–E5 | **P0/P1** |
| Org members / invite | E6, H | P2 |
| Admin moderation | F1–F4 | P1 |
| Notifications | G | P1 |
| Rankings | I | P2 |
| i18n/RTL · theming · responsive · a11y | J | P1 |

---

## 7. Known gaps & risks

- **OAuth** can't be fully automated → cover UI presence; authenticate via credentials.
- **AI** is paid + non-deterministic → tolerant assertions by default; strict path behind a flag.
- **Email** → assert via DB token / provider stub, not a real inbox.
- **Native app** (Capacitor) → not covered by Playwright; needs a device/manual pass.
- **Test DB hygiene** → must reset+seed each run or state leaks (unique emails help but org/race state can drift).
</content>
