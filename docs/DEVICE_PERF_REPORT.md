# ZidRun — Device Performance Report

Comparative testing to determine what optimization work is needed for older / lower-spec Android
devices.

**Run date:** 2026-07-18
**Build:** debug APK, `versionName 2.0` / `versionCode 11`
**Backend:** local dev server at `10.0.2.2:3003` (verified — *not* production)
**Dataset:** 10,087 users · 108 races · 50 runs with full 1500-point GPS routes
**Method:** `docs/EMULATOR_E2E_TEST_PLAN.md`; metrics collected by driving the real Capacitor
WebView over the Chrome DevTools Protocol.

---

> ## ✅ Status — 2026-07-18: P1, P2, and P3 fixed and verified
>
> All findings below have been addressed. Verification is in **§9**, and the numbers in §2–§3
> describe the app **before** the fix — they are kept as the record of what was wrong.
>
> | Item | Result |
> |---|---|
> | **P1** `/account/runs` payload | 9.29 MB → **774 KB** uncompressed; 1.92 MB → **82 KB** gzipped (**95.7%** smaller) |
> | **P2a** silent DB-outage degradation | Outage now renders a real, retryable error instead of "no races" / "Race not found" |
> | **P2b** missing boundaries | Added 7 `error.tsx`, a root `not-found.tsx`, and 7 `loading.tsx` (5 → 12) |
> | **P3** white-on-orange contrast | 2.74:1 → **7.25:1** (passes AA and AAA) across 8 call sites |

## Executive summary

**One screen is responsible for essentially all of the risk: `/account/runs`.**

On a flagship-class device it is merely slow (2.1 s to DOMContentLoaded). On a simulated low-end
device it takes **88.5 seconds to become interactive** — while every other page in the app manages
3.4–8.3 s on the same device. It is not 10% worse than its peers; it is **10–25× worse**, and the
gap is caused by a single fixable server-side decision.

| Question | Answer |
|---|---|
| Does the app work on low-spec hardware? | Yes — every route rendered, nothing crashed |
| Is optimization needed? | **Yes — one P1 item, plus 3 structural items** |
| Is the P1 device-specific? | **No.** It's a payload/DOM bug that weak hardware merely exposes |
| Would fixing one thing help most? | Yes — stop selecting `route` in the runs list query |

---

## 1. Device profiles

Because this app is a **WebView over a server-rendered web app**, the things that decide "does it
feel slow on an old phone" are JS execution speed and network — not emulator RAM. Both profiles
therefore run on the same emulator, with the low-spec profile throttled via CDP using the same
technique Lighthouse uses to model low-end mobile.

| Profile | CPU | Network | Represents |
|---|---|---|---|
| **modern** | unthrottled | unthrottled | Flagship phone on wifi |
| **lowspec** | **4× slowdown** | **400 kbps, 400 ms RTT** | Budget phone on slow 3G |

Host emulator: `Pixel_8`, Android 17 (SDK 37), 8 cores, 4 GB RAM, hardware GPU.

> **Why not a genuinely old emulator?** Four attempts failed and are documented in §6 — this
> matters, because CPU/network throttling does **not** cover older-Android behavior.

---

## 2. Results

### Modern profile — unthrottled

| Route | Wall | TTFB | DCL | FCP | Transfer | DOM nodes |
|---|---|---|---|---|---|---|
| `/` | 3015 ms | 348 | 532 | 416 | 70 KB | 557 |
| `/races` | 3703 ms | 989 | 1209 | 1164 | 104 KB | 982 |
| `/rankings` | 2626 ms | 104 | 177 | 188 | 44 KB | 398 |
| `/account` | 2655 ms | 107 | 154 | 188 | 27 KB | 430 |
| **`/account/runs`** | **4156 ms** | 199 | **2116** | 288 | **1.92 MB** | **2772** |
| `/account/coach` | 5156 ms | 122 | 208 | 220 | 35 KB | 327 |

### Low-spec profile — 4× CPU slowdown + slow 3G

| Route | Wall | TTFB | DCL | FCP | Transfer | DOM nodes |
|---|---|---|---|---|---|---|
| `/` | 81.8 s | 117 | 5835 | 3532 | 70 KB | 557 |
| `/races` | 83.0 s | 116 | 8280 | 3604 | 104 KB | 982 |
| `/rankings` | 76.9 s | 136 | 3496 | 3536 | 36 KB | 397 |
| `/account` | 83.9 s | 145 | 3466 | 3508 | 34 KB | 429 |
| **`/account/runs`** | **127.9 s** | 127 | **88518** | 4188 | **1.92 MB** | 2675 |
| `/account/coach` | 77.2 s | 436 | — | — | — | — |

### The signal

**DOMContentLoaded — time until the page is actually usable:**

| Route | Modern | Low-spec | Degradation |
|---|---|---|---|
| `/rankings` | 177 ms | 3.5 s | 20× |
| `/account` | 154 ms | 3.5 s | 23× |
| `/` | 532 ms | 5.8 s | 11× |
| `/races` | 1.2 s | 8.3 s | 7× |
| **`/account/runs`** | **2.1 s** | **88.5 s** | **42×** |

Every normal page lands in the 3.5–8.3 s band on weak hardware — sluggish but usable.
`/account/runs` lands at **88.5 seconds**. A real user waits a minute and a half staring at an
unresponsive screen, and **there is no `loading.tsx` for this route**, so there is not even a
spinner to explain the wait.

> **Two caveats, stated plainly.**
> 1. **These are dev-mode numbers.** Next.js dev serves unminified JS with HMR attached, which is
>    why the `load` event sits near ~80 s on *every* low-spec page. A production build would be
>    substantially faster across the board. **The absolute numbers are inflated; the relative
>    comparison is the valid finding**, and the 42× outlier is not a dev-mode artifact — it tracks
>    payload and DOM size, both of which are identical in production.
> 2. **`/account/coach` on low-spec returned 300 bytes / 36 nodes.** The page renders fine
>    otherwise (200, 111 KB), so this is a measurement artifact from capturing a transitional
>    state — **not** a bug. Recorded as inconclusive, not as a finding.

---

## 3. Findings

### 🔴 P1 — `/account/runs` sends the entire GPS route history to render a summary list

**Measured** (authenticated, warm, `curl`):

| Route | Uncompressed | Gzipped (on the wire) |
|---|---|---|
| `/account` | 114 KB | 27 KB |
| `/races` | 353 KB | 103 KB |
| **`/account/runs`** | **9.29 MB** | **1.92 MB** |

That is **71× `/account`** and **18.6× `/races`** on the wire.

**Cause** — confirmed in code and database:
- `src/app/account/runs/page.tsx:21` loads 50 runs via `getRunsScreenData(userId, 50)`.
- The query at `src/lib/coach/service.ts:511` is `SELECT *`, which **includes the `route` JSONB** —
  up to 1500 GPS points per run.
- Measured directly: `SUM(pg_column_size(route))` for these 50 runs = **2645 kB in the database**.
- It expands to 9.29 MB over the wire because the route array is serialized **twice** — once in the
  server-rendered HTML and again in the RSC flight payload — with float coordinates written out as
  full decimal text.
- It is then deep-cloned twice more on the server (`page.tsx:22-23`).
- All 50 cards render with no pagination and no virtualization
  (`src/components/coach/coach-runs-panel.tsx:377`) → **2772 DOM nodes**, 6.4× the `/account` page.

**Why the low-spec device suffers so much more.** The 1.92 MB download costs ~38 s on slow 3G, but
that is *not* the main cost — TTFB stayed at 127 ms. The real cost is CPU: parsing 9.29 MB of JSON,
building 2772 DOM nodes, and hydrating them. That work is ~2.1 s on a fast core and **88.5 s at 4×
slowdown**. This is why it is a *low-end device* problem specifically.

**Transfer time at 1.92 MB:**

| Network | Time |
|---|---|
| 4G (10 Mbps) | 1.5 s |
| 3G (1.6 Mbps) | 9.6 s |
| Slow 3G (400 kbps) | 38.4 s |
| 2G / EDGE (240 kbps) | 64.0 s |

> **Correction to an earlier figure.** An initial pass reported ~3.1 minutes on slow 3G using the
> 9.29 MB uncompressed size. The dev server gzips, so real transfer is 1.92 MB and the correct
> figure is **38 s**. The earlier number overstated the network cost by ~4.8×. The CPU cost —
> the dominant one — is unaffected by this correction.

**How much the fix is worth — measured, not estimated.** Summing column sizes for these same 50
runs:

| | Size |
|---|---|
| Full rows (what `SELECT *` fetches) | 2654 kB |
| The `route` column alone | 2645 kB |
| **Everything except `route`** | **9299 bytes** |
| **`route`'s share of the payload** | **99.7%** |

The list screen needs the 9 KB of summary fields plus a *coarse* shape for each thumbnail. It is
currently fetching 2654 kB to render it.

**⚠️ The list genuinely needs *some* route data — don't just drop the column.** Each card renders a
route thumbnail via `RunRouteMap` (`coach-runs-panel.tsx:466`). Removing `route` outright would
silently break every thumbnail. But the thumbnail is a **100×100 SVG viewBox displayed at 56 px**,
with coordinates rounded to 2 decimals (`run-route-map.tsx:26`) — at that size the overwhelming
majority of 1500 points collapse onto the same subpixel and contribute nothing visible.

**Recommended fixes, highest leverage first:**
1. **Downsample `route` server-side for the list view.** Send ~50–100 points per run instead of
   1500. The thumbnail stays visually identical, and this removes ~95% of the payload —
   2645 kB → roughly 100 kB, taking the page from 9.29 MB to a few hundred KB. There is already a
   `downsample()` helper in `src/lib/native/run-engine.ts` to reuse. **This one change addresses
   most of this report while preserving the feature.**
   - Better still: precompute a simplified polyline on write, so the list query never touches the
     full route at all.
2. Fetch the **full** `route` on demand when a card expands and the Leaflet map mounts
   (`/api/coach/runs/[id]` already exists).
3. Note the query is raw SQL — `SELECT * FROM "RunnerRun"` at `src/lib/coach/service.ts:512` — so
   the fix means enumerating columns explicitly rather than adding a Prisma `select:`.
4. Paginate the list — `/account/feed` already does this correctly (`src/lib/social.ts:159`,
   limit 20 + "Load more"). Copy that pattern.
5. Drop the two `JSON.parse(JSON.stringify(...))` deep clones.
6. Add a `loading.tsx` for the route regardless.

### 🟠 P2 — A database outage is indistinguishable from "no results"

`src/lib/race-repository.ts` swallows every DB error into a fallback (`:96`, `:126`, `:150`,
`:203`). Tested by stopping the Postgres container mid-session:

| Request | Result with DB down |
|---|---|
| `/races` (cached filter) | `200`, full page, **stale cached races** |
| `/races?wilaya=Oran&raceType=TRAIL&q=…` (uncached) | `200`, **zero races, no error** |
| `/races/seeded-race-24` | `200`, **"Race not found"**, 4.09 s |

> **Correction to a pre-test hypothesis.** The test plan predicted an outage would render
> *fabricated mock races*. It does not — the mock fallback appears reserved for an unset
> `DATABASE_URL`. The real behavior is subtler and arguably worse: a user searching Oran concludes
> there are no trail races there; a user opening a bookmarked race concludes it was deleted. And
> because every response is `200`, uptime monitoring will not flag the outage either.

**Fix:** distinguish "query returned empty" from "query failed." On failure surface a real error
state with retry, and return non-200 so monitoring catches it.

### 🟠 P2 — No route-level error or loading boundaries

- **Zero `error.tsx` and zero `not-found.tsx`** anywhere in `src/app`. Only the root
  `global-error.tsx`, which replaces the *entire* document — header, nav, locale direction — on any
  server-component throw.
- Only **5 `loading.tsx`** across ~76 routes (`account`, `account/coach`, `account/notifications`,
  `account/registrations`, `races`).

Missing on the slowest routes: `/account/runs` (the 88.5 s page), `/rankings`, `/admin/analytics`,
`/organizer/events/[id]/registrations`, and all of `/admin/*`. On a low-spec device these render as
a frozen screen for seconds at a time with no feedback.

### 🟡 P3 — White-on-orange contrast fails WCAG AA

Visually confirmed on-device: the home "Search" button is white on brand orange `#F47A20`
(~2.75:1, below the 4.5:1 AA threshold). Already tracked as P1 in `UI_AUDIT_TODO.md:41`, still
present in this build.

### ✅ Verified NOT problems

- **Leaflet is correctly lazy-loaded** via `await import("leaflet")` (`run-map.tsx:63`); only its
  CSS import is static. An earlier suspicion that the map library was eagerly bundled was **wrong**.
- **`/races` warm response is 0.28 s** with 108 races. An initial 2.3 s reading was dev-mode
  compilation, not a bottleneck.
- **No N+1 query patterns** — related data is consistently `include`d or batched.
- Charts are hand-rolled SVG, not a library; the OpenAI SDK is server-only with no client leak.

---

## 4. Do we need optimization for old devices?

**Yes — but it is one fix, not a campaign.**

The app is fundamentally sound on weak hardware. Five of six routes land in a 3.5–8.3 s
DOMContentLoaded band under 4× CPU throttling and slow 3G — not fast, but working, and much of that
is dev-mode overhead that disappears in production.

`/account/runs` is the exception, and it is an outlier by an order of magnitude. It is also *not* a
hardware problem being blamed on hardware: it is a query that ships 2.6 MB of GPS coordinates to
render a list of summary cards. Weak hardware simply makes the cost visible — 2.1 s becomes 88.5 s.

**Priority order:**
1. **Fix the runs query** (P1). Highest leverage in the entire codebase.
2. **Add `loading.tsx`** to the slow routes — cheap, and directly addresses "the app froze."
3. **Add route-level `error.tsx`** — prevents whole-app blowouts.
4. **Fix the DB-outage silent degradation** — correctness, not performance.
5. Re-measure against a **production build** before drawing further conclusions.

---

## 5. Reproducing this

```bash
docker compose up -d postgres
npm run dev:lan
CAP_SERVER_URL=http://10.0.2.2:3003 npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p dz.racedz.app -c android.intent.category.LAUNCHER 1

# Forward the WebView devtools socket, then drive it:
PID=$(adb shell pidof dz.racedz.app | tr -d '\r')
adb forward tcp:9222 localabstract:webview_devtools_remote_$PID
npx tsx scripts/.tmp-throttle-perf.ts
```

---

## 6. What this test did NOT cover

Stated explicitly so gaps aren't mistaken for passes.

**Older Android versions — four failed attempts.** Only the API 37 image is installed on this
machine. An API 30 (Android 11) image would not install; a `pixel_2`-profile AVD failed to boot with
GPU `ColorBuffer` errors under both hardware and software rendering; a `-memory 2048 -cores 2`
launch **silently ignored both flags** and reported 3.8 GB RAM (nearly producing a meaningless
"comparison" of a device against itself); and a purpose-built 2 GB AVD never finished booting,
because Android 17 needs more than 2 GB. CPU/network throttling was adopted instead — it is the
right tool for a WebView app, but it does **not** cover older WebView engines, older GPU drivers, or
pre-Android-12 permission and foreground-service behavior.

**Also untested:**
- **Production build.** All numbers here are dev-mode and inflated.
- **Real hardware** — no thermal throttling, real GPS drift, or true battery behavior.
- **The GPS run-recording path** (plan §4). Code-level hotspots are identified — per-fix O(n) route
  copy, full polyline redraw with animated recenter on every fix, 1 Hz full re-render, 200 KB
  snapshot serialization every 4 s — but **not measured on-device**. Needs a 60–90 min simulated run.
- **The missing-index cliff.** `RaceEvent` genuinely has **zero** `@@index` and `RaceRegistration`
  has none for its hot paths, but at 108 races seq scans are too fast to measure. Needs thousands of
  rows to demonstrate — **do not read today's fast `/races` timings as evidence this is fine.**
- Audio coaching, push (gated off), deep links (debug fingerprint only), offline run-queue retry,
  and image upload.

---

## 9. Fixes applied and how they were verified

All verification ran against a **production build** (`npm run build` + standalone server), not the
dev server — dev intercepts server errors with its own overlay before route boundaries render, so
P2 cannot be validated in dev at all.

### P1 — `/account/runs` payload

**Change.** `getRunnerRuns` (`src/lib/coach/service.ts`) now downsamples each run's `route` to
`ROUTE_PREVIEW_POINTS` (64) — enough for the 56px SVG thumbnail. A new
`GET /api/coach/runs/[id]` returns one run with its **full** route, and `coach-runs-panel.tsx`
fetches it when a card expands, caching per run. Until it lands the card renders the preview, so
the map draws coarsely rather than flashing empty; a failed fetch simply leaves the preview.

**Why not just drop the column:** the list genuinely needs route data for the thumbnails, and the
*expanded* card needs full fidelity because `RunSummary` computes per-km splits from the points.
Downsampling globally would have silently corrupted those splits.

| Measurement (same dev server, before vs after) | Before | After | Change |
|---|---|---|---|
| Uncompressed | 9,294,652 B | 773,845 B | **−91.7%** |
| Gzipped (on the wire) | 1,920,183 B | 82,207 B | **−95.7%** |
| Server time | 1.40 s | 0.51 s | −64% |

Production build after the fix: **762,397 B / 78,033 B gzipped / 0.44 s** — `/account/runs` is now
in the same band as `/races` (54 KB gzipped) instead of 18.6× larger.

**Behavioural verification** (headless browser, 50 runs, A/B by blocking the detail request):

| Scenario | Leaflet polyline path length | Thumbnails rendered |
|---|---|---|
| Detail fetch **blocked** (preview only) | 144 | 49 / 49 |
| Detail fetch **allowed** (full route) | **517** | 49 / 49 |

Thumbnails render unchanged from the preview; the expanded map upgrades to full fidelity when the
fetch lands; and the degraded path still draws a map. The detail endpoint was confirmed to return
all **1500** points for a 1500-point run, while the list returns **64**.

### P2a — DB outage no longer degrades silently

**Change.** `src/lib/race-repository.ts` no longer swallows query errors into mock data. A new
`RaceDataUnavailableError` is thrown from all four read paths, logged first. The
no-`DATABASE_URL` mock path is untouched — that fallback is deliberate.

**Verified** by stopping the Postgres container against the production build:

| Request | Before | After |
|---|---|---|
| Uncached race search | `200`, zero races, no error | **"We couldn't load races"** + Try again / Go back |
| Race detail | `200`, **"Race not found"** | **"We couldn't load this race… the race has not been removed"** |
| Genuinely missing slug (DB **up**) | Next's bare default | **"Page not found"** with the site shell |

The important distinction now holds: an outage and a deleted race no longer look identical. Normal
behaviour with the DB up was re-checked and is unchanged.

### P2b — Route-level boundaries

- **`error.tsx` × 7** — `races`, `races/[slug]`, `account`, `admin`, `organizer`, `rankings`,
  `blog`, all sharing a new `src/components/ui/route-error.tsx` (reports to Sentry, shows the
  error digest, offers retry + escape). Previously **zero** existed, so any server-component throw
  escalated to `global-error.tsx` and replaced the whole document.
- **`not-found.tsx`** at the app root — previously missing entirely.
- **`loading.tsx` × 7 added** (5 → 12), covering the slowest routes: `account/runs`, `rankings`,
  `admin`, `admin/analytics`, `organizer`, `organizer/events/[id]/registrations`, `blog`.

### P3 — Contrast

**Change.** 8 raw call sites using `text-white` on `bg-brand-orange` now use `text-[#18001c]`,
matching the convention the `Button` component already established. (Dark and race themes already
forced dark ink via `globals.css`; only **light** mode was failing.) The email CTA was already
fixed previously.

**Verified** by computing the ratio from the browser's own computed styles on the live home page:
`rgb(24,0,28)` on `rgb(244,122,32)` = **7.25:1** (was 2.74:1; AA needs 4.5:1).

### Regression checks

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | 2 errors, both pre-existing in `scripts/_stubs/`; warnings unchanged at 273 |
| `npm run build` | succeeds |
| `test:coach`, `test:workout`, `test:audio`, `test:mfa` | all pass |
| `tests/auth.e2e.spec.ts` | **11/11 pass** |
| `tests/coach.e2e.spec.ts` | 1 fail — **pre-existing** (expired demo trial) ⚠️ |
| `tests/visual.e2e.spec.ts` — desktop structural | **3/3 pass** |
| `tests/visual.e2e.spec.ts` — mobile structural | 5 fail — **pre-existing** (auth-redirect origin mismatch) ⚠️ |
| `tests/visual.e2e.spec.ts` — snapshots | 17 fail — **expected**, P3 changes button colour; baselines need review ⚠️ |

Every failure was verified against unmodified code via `git stash`. **No regression was introduced
by these changes.**

> **⚠️ The coach e2e failure is a test-data problem, not a regression.** The spec expects the
> coach overview heading, but `runner@example.com` signed up **2026-06-15** — 33 days ago — and has
> no `CoachSubscription` row. With `COACH_TRIAL_DAYS` defaulting to 7
> (`src/lib/coach/entitlement.ts:18`), the demo runner's trial has long expired, so `/account/coach`
> correctly shows the subscribe view instead. **This spec breaks whenever the seed data is more than
> a week old** — worth fixing by seeding an active subscription or freshening `createdAt`.

### ⚠️ Two further pre-existing test failures — proven not to be regressions

Running the **full** Playwright suite surfaced 22 failures. Each was traced to a cause that exists
independently of these changes; both were verified by `git stash`-ing the source changes and
re-running against unmodified code.

**1. Five mobile "structural UI regression" failures — an auth-redirect origin mismatch.**

Every failure is `waitForLoadState("networkidle")` timing out, and only on **mobile** viewports
(desktop passes 3/3). Cause:

- The **mobile tab bar** RSC-prefetches `/account`, `/account/runs`, and `/account/coach` on every
  page load. The desktop nav does not — which is why only mobile fails.
- Those routes are auth-gated, and the middleware redirects anonymous requests to
  **`http://localhost:3003/login`** — even when the page was loaded from `http://127.0.0.1:3003`,
  and even with `AUTH_URL`/`NEXTAUTH_URL`/`AUTH_TRUST_HOST` explicitly set to the `127.0.0.1` form.
- Playwright's default `baseURL` is `http://127.0.0.1:3003` (`playwright.config.ts:3`), so those
  three prefetches become cross-origin, never settle, and `networkidle` never fires.

**Verified pre-existing:** with all source changes stashed, `curl -D - http://127.0.0.1:3003/account`
still returns `location: http://localhost:3003/login`, and the test still fails.

Two things worth following up, independent of this work:
- The `127.0.0.1` vs `localhost` mismatch makes the mobile visual suite unrunnable at the default
  base URL. Running with `RACEDZ_BASE_URL=http://localhost:3003` should sidestep it; the real fix is
  making the middleware redirect preserve the request's own origin.
- **The mobile tab bar prefetching `/account/runs` deserves attention on its own.** Before the P1
  fix, every mobile page view was speculatively fetching the 9.29 MB screen in the background. That
  amplified P1 well beyond users who actually opened the page, and is a strong argument for
  `prefetch={false}` on the heavier tabs.

**2. Seventeen visual-snapshot failures — expected, and awaiting review.**

`tests/visual.e2e.spec.ts` compares against committed baselines. The P3 contrast fix deliberately
changes button text colour on the home, races, and login pages across light/dark/race themes, so
these baselines are *supposed* to differ. **They have deliberately not been regenerated** — the
baselines should be updated only after a human reviews the rendered diffs:

```bash
npm run test:e2e:visual -- --update-snapshots
```

---

## 10. Test environment notes

Two setup issues were hit and worked around:

1. **`npm run prisma:seed` fails on a pre-rebrand database.** The seed upserts the organizer on
   `email: organizer@zidrun.com`, but an existing row held that user's `nationalId`
   (`ORG-DEMO-001`) under the **old** address `organizer@racedz.dz` — a ZidRun rebrand leftover. The
   seed aborts with `P2002` partway through, leaving the demo organizer missing. Worked around by
   renaming the existing row's email in place — chosen over delete-and-reseed because that user owns
   an **APPROVED organization with 24 races**. Worth a real fix so the seed is idempotent against
   pre-rebrand data.
2. **The `sharp` undeclared-dependency bug was not reproduced.** `src/lib/storage.ts:4` imports it
   while `package.json` does not declare it; it resolves here transitively. It will still break a
   clean install or fresh Docker build. Image upload was not exercised.

**Test tooling.** The measurement scripts (`seed-runs.ts`, `throttle-perf.ts`) were written to the
session scratchpad and removed from the repo — the working tree is clean apart from this report and
the test plan.

**⚠️ Left in the local database on purpose:** 48 seeded perf-test runs on `runner@example.com`
(titled `Perf test run N`), kept so this measurement can be repeated. They are synthetic and will
skew any other use of this dev database. Remove with:

```sql
DELETE FROM "RunnerRun"
WHERE title LIKE 'Perf test run %'
  AND "userId" = (SELECT id FROM "User" WHERE email='runner@example.com');
```

**Also changed in the local database:** the organizer's email was renamed from `organizer@racedz.dz`
to `organizer@zidrun.com` (see item 1 above). This is a data change, not a code change — revert it
if the old address matters for anything.
