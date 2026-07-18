# ZidRun — Android Emulator End-to-End Test Plan

Manual + scripted test plan for exercising **every feature from the Android emulator**, hunting for
functional gaps, UI issues, and performance problems.

**Why this doc exists:** `docs/TEST_AUTOMATION_PROGRESS.md:47` states plainly that Playwright covers
mobile *web viewports* only — "not native Android behavior, GPS, push notifications, or
keyboard/status-bar integration." This plan fills exactly that gap. It complements, and does not
duplicate:

| Doc | Scope |
|---|---|
| `docs/QA_CHECKLIST.md` | Manual desktop-browser QA |
| `docs/E2E_TEST_PLAN.md` | Playwright browser journeys |
| `docs/E2E_TEST_STRATEGY.md` | High-level automation strategy |
| **this doc** | **Native Android shell on an emulator** |

Re-run this plan before every APK release (see `apk-release-versioning` — bump `versionName` /
`versionCode` in `android/app/build.gradle`, currently `2.0` / `11`).

---

## 0. Setup — read this first

### ⚠️ The single biggest footgun

`capacitor.config.ts:12` defaults `server.url` to **`https://zidrun.com`**. The native shell is a
webview over a *hosted* app, not a static bundle. If you run `npm run android:run` without
`CAP_SERVER_URL`, **you will be testing production**, not your local changes — and any write test
(register, publish race, approve subscription) will mutate real data.

Always sync against local first:

```bash
# 1. Backend up
docker compose up -d postgres
npx prisma migrate status          # must be current
npm run prisma:seed                # demo accounts + races
npm run seed:tips                  # coach tips

# 2. Dev server bound to all interfaces so the emulator can reach it
npm run dev:lan                    # 0.0.0.0:3003

# 3. Point the shell at the host loopback alias and rebuild
CAP_SERVER_URL=http://10.0.2.2:3003 npm run cap:sync
npm run android:run
```

Confirm before testing anything:

```bash
adb shell pm list packages | grep racedz     # expect dz.racedz.app
adb logcat -d | grep -i "capacitor.*url"     # expect 10.0.2.2:3003, NOT zidrun.com
```

### Demo accounts (`prisma/seed.ts`)

| Role | Email | Password |
|---|---|---|
| Superadmin | `admin@zidrun.com` | `racedz-demo-password` |
| Organizer | `organizer@zidrun.com` | `racedz-demo-password` |
| Runner | `runner@example.com` | `racedz-demo-password` |

### Emulator toolbox

```bash
adb logcat -c && adb logcat | grep -iE "chromium|capacitor|error|fatal"  # live console
adb emu geo fix 3.0588 36.7538                  # teleport to Algiers
adb shell input keyevent KEYCODE_BACK           # hardware back
adb shell dumpsys battery unplug                # simulate on-battery
adb shell am broadcast -a android.intent.action.ACTION_SHUTDOWN  # Doze-ish
adb shell svc wifi disable && adb shell svc data disable         # go offline
adb shell dumpsys meminfo dz.racedz.app         # memory snapshot
adb shell screenrecord /sdcard/run.mp4          # capture a session
```

GPS route simulation (for run tracking) — Extended Controls → Location → Routes, or replay a GPX.
`adb emu geo fix` only sets a single point; you need a moving sequence to produce distance.

**Known env caveats:** native push is gated off via `NEXT_PUBLIC_NATIVE_PUSH_ENABLED` with no
`google-services.json` (see `native-push-gated`), and `assetlinks.json` lists only the debug
fingerprint. Both limit what can be verified on the emulator — flagged per-section below.

---

## 1. Cold start, shell & chrome

| # | Test | Expected | Watch for |
|---|---|---|---|
| 1.1 | Fresh install, first launch | Splash `#0c1116` + ZidRun wordmark, hides on mount | Splash stuck to the 3s `launchShowDuration` cap = web app failed to mount |
| 1.2 | Time to interactive | Home usable < 3s on local | Blank white flash between splash and app |
| 1.3 | Status bar / safe area | No content under the status bar or gesture bar | Notch overlap, content under nav pill |
| 1.4 | Hardware back button | Pops webview history, exits at root | Back exiting the app from a deep page, or trapping the user |
| 1.5 | Background → foreground | State preserved, no full reload | Session loss, scroll reset |
| 1.6 | Rotate to landscape | Layout reflows | Horizontal overflow, clipped modals |
| 1.7 | Kill and relaunch | Session persists | Forced re-login |

---

## 2. Auth

Covers `/login`, `/login/mfa`, `/register`, `/forgot-password`, `/reset-password/[token]`,
`/verify-email/[token]`, `/invite/[token]`.

| # | Test | Expected | Watch for |
|---|---|---|---|
| 2.1 | Register a new runner | Account created → `/login?registered=1` | **Password hint says "6 characters" but field is `minLength={8}`** — known P1, `UI_AUDIT_TODO.md:42` |
| 2.2 | Login before verifying email | Blocked with a clear message | Generic/again-unhelpful error |
| 2.3 | Open verify-email link | Account activates | Deep link opens browser instead of app (expected on debug — assetlinks has debug FP only) |
| 2.4 | Login as each of the 3 roles | Runner→`/account/registrations`, organizer→`/organizer`, admin→`/admin` | Wrong landing route |
| 2.5 | MFA: enroll TOTP via QR | QR scannable, 10 backup codes issued | QR too small on a phone screen |
| 2.6 | MFA: login with TOTP, then a backup code | Both work; backup code is single-use | Reuse accepted |
| 2.7 | Wrong password ×N | Rate limit engages (`src/lib/rate-limit.ts`) | No lockout; or lockout with no user-facing explanation |
| 2.8 | Google native sign-in | Browser → `zidrun://auth?token=` → session | Needs prod OAuth; **expect failure against local** — record, don't chase |
| 2.9 | Keyboard on login fields | Body resizes (`KeyboardResize.Body`), field stays visible | Input hidden behind the keyboard — the classic Capacitor bug |
| 2.10 | Password manager / autofill | Fields accept autofill | |
| 2.11 | Logout | Session cleared, header returns to signed-out | |

---

## 3. Race discovery & registration

| # | Test | Expected | Watch for |
|---|---|---|---|
| 3.1 | `/` home | Header, theme + lang switch, CTA, footer | **Duplicate hero title**, 7 targets in hero — known P2, `UI_AUDIT_TODO.md:59-60` |
| 3.2 | `/races` search + 4 filters | Results narrow correctly | Filter selects unusable at 360dp; overflow |
| 3.3 | Scroll a long race list | Smooth | Jank; check whether pagination exists at all vs unbounded render |
| 3.4 | Race detail | Image, date, location, capacity, categories, price, rules, contact | Layout collapse with long Arabic strings |
| 3.5 | Register for a race | Confirmation → appears in `/account/registrations` | |
| 3.6 | Register when full | Blocked cleanly | Capacity race condition — `scripts/test-registration-concurrency.ts` covers the server side |
| 3.7 | Registration certificate / bib | Renders, downloadable | PDF/image generation on mobile webview |
| 3.8 | Cancel a registration | Status updates both sides | |

---

## 4. GPS run tracking — highest-risk area

Engine: `src/lib/native/run-engine.ts`, recorder UI `src/components/coach/run-recorder.tsx`.
The engine is deliberately module-level (not React state) so a run survives navigating away — test
that claim hard.

| # | Test | Expected | Watch for |
|---|---|---|---|
| 4.1 | Grant location on first run start | Permission prompt, then tracking | Denial path: `errorCode: "NOT_AUTHORIZED"` should be user-visible, not silent |
| 4.2 | **Navigate away mid-run**, return | Run still recording, metrics intact | The core architectural claim — a reset here is a P1 bug |
| 4.3 | Screen off 5 min while tracking | Foreground-service notification persists; distance keeps accruing | Android killing the service |
| 4.4 | Background the app 10 min | Same | Doze suppression |
| 4.5 | **Revoke location mid-run** (Settings → permissions) | Graceful error, run not silently corrupted | Crash, or distance frozen with no warning |
| 4.6 | Simulate a long route (> 3000 points) | Route downsamples at `MAX_ROUTE_POINTS * 2` → 1500 (`run-engine.ts:378`) | Verify the *displayed* distance doesn't jump when downsampling fires |
| 4.7 | Pause / resume | `movingSec` excludes paused time; gaps > 15s ignored (`MAX_MOVING_GAP_S`) | |
| 4.8 | GPS accuracy degradation | `gpsAccuracy` surfaces to the user | Garbage distance from bad fixes |
| 4.9 | Battery drain over a 30-min run | Reasonable | Snapshot writes every 4s (`SNAPSHOT_INTERVAL_MS`) + per-tick re-render — profile with `dumpsys batterystats` |
| 4.10 | Memory over a long run | Stable | Route array growth before downsample; `dumpsys meminfo` |
| 4.11 | Save a run | Appears in `/account/runs` with map | |
| 4.12 | **Offline save** (wifi+data off) | Queued to `racedz-run-queue` localStorage (`src/lib/coach/run-queue.ts`) | |
| 4.13 | Reconnect after offline save | Auto-retries and uploads | **Duplicate submission** — the highest-value bug to hunt here |
| 4.14 | Force-kill mid-run, relaunch | Run restored from snapshot | Data loss window up to 4s is expected; total loss is not |
| 4.15 | Run map render (Leaflet) | Loads lazily (verified: `run-map.tsx:63` uses `await import`) | First-paint delay on the map tab |
| 4.16 | GPX import / export | Round-trips | |
| 4.17 | Run photos upload | Compresses (`compress-image.ts`, skips < 1MB), uploads | 5MB cap in `storage.ts:10` — test a 6MB photo for a clean rejection |

---

## 5. Audio coaching

`src/lib/native/cues.ts`, `src/lib/coach/audio-coaching.ts`, TTS plugin.

| # | Test | Expected | Watch for |
|---|---|---|---|
| 5.1 | Enable audio cues, start a run | Spoken cues at intervals | |
| 5.2 | Cues in FR and AR | Correct language + pronunciation | Arabic TTS voice may be missing on the emulator — record as env limitation |
| 5.3 | Cues with screen off | Still speak | |
| 5.4 | Cues over music | Ducks, doesn't stop playback | |
| 5.5 | Headphones connect/disconnect mid-run | Routes correctly | |
| 5.6 | Mute mid-run | Stops immediately | |

---

## 6. AI Coach

`/account/coach`, `/account/coach/notes`, `/account/coach/subscribe`.

| # | Test | Expected | Watch for |
|---|---|---|---|
| 6.1 | Coach as NONE tier | Redirects to `/account/coach/subscribe` | |
| 6.2 | Subscribe flow + payment-proof upload | Request PENDING | File picker on Android; large-image handling |
| 6.3 | Admin approves (`/admin/coach`) | Tier becomes SUBSCRIBED | |
| 6.4 | Goal wizard | Plan generated | **No real validation — not a `<form>`, so `min`/`max`/`required` are decorative; `targetTime="abc"` → `NaN` reaches the API.** Known P1, `UI_AUDIT_TODO.md:43` |
| 6.5 | Chat with the coach | Streams a response | Latency on mobile; keyboard covering the input |
| 6.6 | Trial limits (3/day, 30/mo) | Enforced at the boundary | Off-by-one at exactly the limit; day-7 trial expiry |
| 6.7 | Subscribed limits (20/day, 400/mo) | Enforced | |
| 6.8 | Workout guidance / guided session | Steps advance | |
| 6.9 | Sleep + nutrition logging | Persists | |
| 6.10 | Audio transcribe (`/api/coach/transcribe`) | Mic permission, transcription returns | RECORD_AUDIO prompt |
| 6.11 | Coach with no runs logged | Sensible empty state | Cold-start advice quality |

---

## 7. Social

| # | Test | Expected |
|---|---|---|
| 7.1 | `/account/feed` renders | Posts load |
| 7.2 | Follow / unfollow a runner | Reflects immediately |
| 7.3 | Kudos on a run | Increments, idempotent |
| 7.4 | Share a run publicly, view as another user | Visible |
| 7.5 | Private run stays private | Not in feed |
| 7.6 | Report content → `/admin/reports` | Appears for admin |

---

## 8. Organizer

| # | Test | Expected | Watch for |
|---|---|---|---|
| 8.1 | Request organizer access | Pending org created | |
| 8.2 | Admin approves | Role upgraded | |
| 8.3 | Create an event + categories | Saved as pending review | Long multi-section form on a phone — the top usability risk here |
| 8.4 | Edit / publish / cancel an event | Lifecycle correct | |
| 8.5 | View registrations, enter result times | Saved | Wide table on a 360dp screen |
| 8.6 | CSV export | Downloads on Android | Webview download handling — likely failure point |
| 8.7 | Invite a member | Invite email → `/invite/[token]` | |

---

## 9. Admin

| # | Test | Expected | Watch for |
|---|---|---|---|
| 9.1 | Dashboard | Stats render | |
| 9.2 | Users list + detail, block a user | `/blocked` shown to that user | |
| 9.3 | Approve/reject races and orgs | State changes, audit logged | |
| 9.4 | `/admin/races/import` (AI vision) | Image → DRAFT race | Slow LLM call — needs a loading state; see §12 |
| 9.5 | Announcements + broadcast | Delivered | |
| 9.6 | Tips moderation | | |
| 9.7 | Support inbox | | |
| 9.8 | `/admin/audit` | Entries present | Large table on mobile |
| 9.9 | `/admin/analytics` | Charts render | Chart perf/readability on a phone |

---

## 10. i18n & RTL

Locale is `?lang=` + a `racedz-locale` cookie, resolved in `src/middleware.ts`. `dir` is set by an
**inline script in `src/app/layout.tsx:76` reading `location.search`** — so RTL correctness under
*client-side* navigation and cookie-only (no `?lang`) loads is genuinely at risk. Test it directly.

| # | Test | Expected | Watch for |
|---|---|---|---|
| 10.1 | Switch EN → FR → AR | Copy changes everywhere | Untranslated strings (some are intentional — see `i18n-translation-boundary`) |
| 10.2 | AR sets `dir="rtl"` | Layout mirrors | |
| 10.3 | **Client-nav to a new page while in AR** | Still RTL | `dir` reverting to LTR — the inline-script risk above |
| 10.4 | **Relaunch app with only the cookie set (no `?lang`)** | Still AR + RTL | Same risk |
| 10.5 | Directional icons in RTL | Mirrored | **Known: chevrons in `pagination.tsx:59/64`, native header back, drawer nav do NOT mirror** — `UI_AUDIT_TODO.md:50` |
| 10.6 | Long AR/FR strings | No overflow | Button text clipping |
| 10.7 | Locale redirect on a deep link | No redirect loop | |
| 10.8 | Coach run-photo overlay in AR | Buttons on the correct edge | **Known: `run-photos.tsx:85,94` use physical `right-1`/`bottom-1`** — will sit on the wrong edge in Arabic. User-facing coach screen. |
| 10.9 | First paint in AR (before hydration) | Correct direction | **`<html lang="en">` is hardcoded (`layout.tsx:68`)** and direction is patched client-side — SSR HTML is always LTR, so expect a flash of wrong direction. An AR user landing *without* `?lang=ar` gets LTR until hydration. |

**RTL is otherwise in good shape:** 38 explicit `dir=` props, and the localized surfaces (coach,
social, account, races, ui) contain only 4 physical-direction Tailwind classes total — logical
properties are used consistently. The 431 physical classes are concentrated in `/admin` and
`/organizer`, which aren't Arabic-localized, so they're out of scope.

### 10b. Accessibility

Test with TalkBack enabled (`Settings → Accessibility → TalkBack`) and with a Bluetooth/USB keyboard.

| # | Test | Expected | Watch for |
|---|---|---|---|
| 10.10 | Keyboard-only: open a confirm dialog, tab around | Focus trapped inside, restored on close | **Known: no modal focus trap or focus restoration anywhere.** `confirm-dialog.tsx` has correct `role="dialog"`/`aria-modal`, Escape handling (:39) and body-scroll lock (:37), but never moves focus in or restores it — you can tab straight out behind the overlay. Same in `image-lightbox.tsx:65-67`. |
| 10.11 | Skip to main content | Link available on first Tab | **Known: no skip link anywhere** in layout or header |
| 10.12 | TalkBack on the run map | Meaningful description | `run-map.tsx:94` is a bare `<div aria-label>` with no `role` — the label is inert on a generic div, and there's no text alternative for the route. Also the only hardcoded English string in that component. |
| 10.13 | TalkBack on first paint in AR | Correct `lang` announced | See 10.9 — initial `lang` is wrong for screen readers |
| 10.14 | Escape closes menus | Works | Already consistent across language/account/theme switchers — spot-check only |
| 10.15 | Reduced motion enabled | Animations suppressed | `gps-scroll-trail.tsx:75` already respects it — verify the run map's animated recenter does too (§12b H6) |

---

## 11. Theme & visual

| # | Test | Expected | Watch for |
|---|---|---|---|
| 11.1 | Light / dark / race modes across all main screens | Readable everywhere | Follow `theme-class-remap-convention` |
| 11.2 | Loading skeletons in dark mode | Theme-aware | **Known: `Skeleton` uses `bg-gray-200`, flashes bright on dark/race** — `UI_AUDIT_TODO.md:48` |
| 11.3 | Primary buttons | AA contrast | **Known P1: white-on-orange ≈ 2.75:1, fails AA** — `UI_AUDIT_TODO.md:41` |
| 11.4 | Horizontal overflow at 360dp | None on any screen | Reuse `assertNoHorizontalOverflow` from `tests/helpers.ts` |
| 11.5 | Tap targets | ≥ 44px | Known partial gaps in `Button size=sm` / native header |
| 11.6 | Notification bell | Opening should not silently clear all unread | **Known deferred: auto-marks-all-read on open** — `UI_AUDIT_TODO.md:49` |

---

## 12. Performance & resilience

| # | Test | How | Watch for |
|---|---|---|---|
| 12.1 | Cold start time | `adb shell am start -W dz.racedz.app/.MainActivity` | |
| 12.2 | Memory after 20 min of mixed use | `dumpsys meminfo` | Leaks across navigation |
| 12.3 | Battery over a 30-min tracked run | `dumpsys batterystats` | §4.9 |
| 12.4 | Throttled network (Extended Controls → Cellular → Edge/3G) | App usable | Missing loading states; timeouts |
| 12.5 | **Offline navigation** | Graceful messaging | Webview "no internet" error page = poor UX |
| 12.6 | Server 500 mid-flow | Handled | **There are ZERO route-level `error.tsx` / `not-found.tsx` files** — only the root `global-error.tsx`. Any route error escalates to a full-page global error. High-value gap. |
| 12.7 | Slow route loading states | Spinner/skeleton shown | **Only 5 `loading.tsx` exist** (`account`, `account/coach`, `account/notifications`, `account/registrations`, `races`). None for `/admin/*`, `/organizer/*`, `/blog`, `/rankings` — these will show a blank/frozen screen on slow mobile networks. |
| 12.8 | Large list rendering | Scroll `/admin/audit`, `/admin/users`, `/races` with seeded bulk data | No virtualization anywhere; see §12b for where pagination is genuinely missing |
| 12.9 | Rapid tab switching in coach | No crash | `coachRequest` (`src/components/coach/api.ts:3`) has no dedupe, cache, retry, or abort — in-flight races are plausible |
| 12.10 | Image-heavy screens | Reasonable memory | Local-filesystem uploads under `public/uploads` |

### 12b. Known performance hotspots — target these deliberately

These are code-confirmed, not speculative. Each one has a specific emulator test.

**H1 — `/account/runs` is the heaviest screen in the app.**
`src/app/account/runs/page.tsx:21` loads 50 runs via `getRunsScreenData(userId, 50)`; the query is
`SELECT *` (`src/lib/coach/service.ts:511`) which **includes the `route` JSONB** — up to 1500 GPS
points per run. That's a multi-MB RSC payload, then deep-cloned twice server-side
(`page.tsx:22-23`), then all 50 cards render with no pagination and no virtualization
(`coach-runs-panel.tsx:377`), each able to mount a Leaflet map on expand.
*Test:* seed 50+ runs with full routes, open `/account/runs` on throttled 3G. Measure TTFB, payload
size, scroll jank. **Expect this to be the worst result in the whole pass.** Note there is also no
`loading.tsx` for this route, so the user sees a frozen screen throughout.

**H2 — `/races` pagination is cosmetic.**
`fetchRaceEvents` (`src/lib/race-repository.ts:155-200`) has **no `take`** — it fetches every
matching PUBLISHED race with the full include, and `races/page.tsx:52` slices in memory. Each filter
permutation also pins a full result set in `unstable_cache`.
*Test:* seed several hundred races, then page through `/races` and vary filters.

**H3 — Missing database indexes (the sharpest cliff).**
- **`RaceEvent` has ZERO `@@index`** (`prisma/schema.prisma:157-209`) — only `slug @unique`. The
  public listing filters on `status`, `wilaya`, `raceType`, `registrationStatus`, dates, and sorts
  by `startDate`. Every render is a seq scan + sort.
- **`RaceRegistration` has no `@@index`** (`:311-336`) — but is queried by `raceEventId`
  (`src/lib/organizer.ts:312`) and `userId` + `createdAt` (`src/lib/registrations.ts:69`). Seq scan
  on the busiest organizer screen.
- **Leaderboard** (`src/lib/leaderboard.ts:36-76`) — `DISTINCT ON (userId)` over `isPublic`, sorted
  by pace/distance. Existing `RunnerRun` indexes (`[userId, startedAt]`, `[goalId, startedAt]`)
  don't help `/rankings`.
*Test:* seed bulk data and compare cold response times for `/races`, `/rankings`,
`/organizer/events/[id]/registrations` before/after adding indexes.

**H4 — `getRunnerRecords` is unbounded.**
`src/lib/coach/service.ts:836` does a `findMany` over the runner's **entire** run history on every
`/account/runs` and coach-dashboard load. Grows without bound per user; should be a SQL aggregate.

**H5 — All images are unoptimized.**
`next.config.ts:52` sets `images: { unoptimized: true }` globally, so every `next/image` is a
pass-through `<img>` — no resizing, no WebP, no `srcset`. And `sharp` re-encodes uploads but
**never resizes** (`src/lib/storage.ts:100-111`), so a 5 MB 6000×4000 phone photo is stored and
served at full dimensions.
*Test:* upload a 5 MB full-resolution photo, then measure exactly what bytes come back on throttled
mobile data. This is the top mobile-data/LCP risk.

**H6 — Per-GPS-fix O(n) work during a run.** (Feeds §4.9/4.10.)
- `run-recorder.tsx:317` copies the **entire** route array on every fix; `:321` recomputes **all**
  splits over the whole route on every fix. At 3000 points that's two full traversals per fix.
- `run-map.tsx:38-51` rebuilds the whole polyline and fires an **animated** `setView` on every fix —
  a known Android WebView battery/GPU drain.
- `run-engine.ts:400` ticks at 1 Hz emitting a **new state object**, so `run-recorder.tsx:132`
  re-renders the entire recorder tree (8 stat tiles, guidance panel, splits chart, map) every
  second for the whole run — plus once per fix, plus once per *rejected* noisy fix (`:337`).
- `run-engine.ts:365` + `run-store.ts:28` `JSON.stringify` the full snapshot (~200 KB at 3000
  points) to Capacitor Preferences **every 4 s**, on the JS main thread — ~1350 growing writes on a
  90-min run.
*Test:* the 60–90 min run in §4. Watch for UI responsiveness degrading as point count climbs — the
degradation should be visible past ~2000 points if these are real.

**H7 — DB errors are silently swallowed into mock data.**
`race-repository.ts` catches every DB error and falls back to mock races (`:96`, `:126`, `:150`,
`:203`). A production DB outage renders `/races` with **fake races and no error signal**.
*Test:* stop Postgres mid-session and reload `/races`. If you see races, that's the bug.

**Verified NOT a problem** (checked, don't re-investigate): Leaflet JS is correctly lazy-loaded via
`await import()` (`run-map.tsx:63`) — though its CSS import at `:3` is static and lands in the
parent chunk. The OpenAI SDK is server-only with no client leak. Charts are hand-rolled SVG, not a
library. No N+1 loops — related data is consistently `include`d or batched. `/account/feed` is the
one correctly-paginated list (cursor + limit 20) — use it as the pattern reference.

---

## 13. Known gaps to confirm and record

Not test failures — **already-known defects and unimplemented features**. Confirm current state and
note anything that has drifted.

1. **`sharp` is imported but not declared in `package.json`** (`src/lib/storage.ts:4`) — see
   `sharp-undeclared-dependency`. Any image upload breaks on a clean install / fresh Docker build.
   *Verify this still reproduces; it is the most likely hard failure in §4.17 and §6.2.*
2. **No Android share target** — no `ACTION_SEND` intent filter in `AndroidManifest.xml`. The
   social-post race import is admin-side image upload only; the OS share-sheet flow is Phase 2
   (see `social-post-race-import`).
3. **Native push gated off** — `NEXT_PUBLIC_NATIVE_PUSH_ENABLED` unset and no
   `google-services.json`; registration no-ops (`native-push-gated`). Push cannot be tested on the
   emulator as configured.
4. **App Links unverified for release** — `assetlinks.json` carries the debug fingerprint only, so
   deep links open via chooser rather than auto-opening.
5. **No unit-test runner** — no Jest/Vitest; only `tsx` scripts + Playwright.
6. **Uploads are local-filesystem** (`public/uploads`), not S3 — breaks multi-instance deploys.
7. **Race discovery falls back to mock data when `DATABASE_URL` is unset** — can mask a real DB
   failure during testing. Confirm you are on real data before trusting §3.
8. Open UI items: everything under **P3** in `UI_AUDIT_TODO.md`, plus the cross-cutting sweeps
   (Button `outline`/`ghost` focus ring, `size=sm` 44px, rankings/audit `gray-400`).
9. **No virtualization anywhere** in the codebase, and no `next/dynamic` usage at all.
10. **`src/lib/i18n.ts` is 1942 lines** and `src/components/coach/copy.ts` is 1157 — all three
    locales ship to the client in any component importing them. No per-locale splitting. Combined
    with the static Leaflet CSS import, `/account/runs` and `/coach` are the two routes worth a
    bundle analysis.

---

## 14. Bug reporting template

```
### [Area] Short title
Severity: P1 blocker / P2 major / P3 minor / P4 polish
Device: Pixel_8 emulator, Android 17, APK vX.Y (versionCode N)
Backend: local 10.0.2.2:3003 @ <git sha>

Steps:
1.
2.

Expected:
Actual:

Evidence: screenshot / screenrecord / logcat excerpt
Notes: known issue? (cross-ref UI_AUDIT_TODO.md / this doc §13)
```

---

## 15. Suggested run order

Roughly 3–4 hours for a full pass.

1. §0 setup — **verify you are on `10.0.2.2:3003`, not prod**
2. §1 shell → §2 auth (unblocks everything)
3. §3 races → §8 organizer → §9 admin (the create→approve→register lifecycle in one sweep)
4. §4 GPS + §5 audio (longest; run the 30-min battery/memory test in the background while doing §6)
5. §6 coach → §7 social
6. §10 i18n/RTL → §11 theme (cross-cutting; do them last, over screens you already know)
7. §12 performance
8. §13 confirm known gaps, file everything via §14

**Fastest path to signal if you only have 45 minutes:**
§0 → §2.1/2.4/2.9 → §4.2/4.12/4.13 → §12b H1 → §12b H7 → §12.6 → §13.1.

That covers, in order of expected value:
1. **H1** `/account/runs` multi-MB payload — the heaviest screen, and the most likely to be visibly
   bad on a phone.
2. **H7** DB-outage → silent fake races — a correctness bug that hides other failures.
3. **§4.13** offline-queue duplicate submission — the data-integrity path.
4. **§4.2** run survives navigation — the core architectural claim; a failure here is P1.
5. **§12.6** no route-level error boundaries — structural.
6. **§13.1** `sharp` undeclared — the one confirmed crash-level bug.
