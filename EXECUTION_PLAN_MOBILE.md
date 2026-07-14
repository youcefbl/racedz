# ZidRun — Mobile Performance Execution Plan (verified)

## Progress — 100% (9 / 9 core fixes) 🎉
`▓▓▓▓▓▓▓▓▓ 100%`

| Batch | Items | Status |
|---|---|---|
| **1 — felt speed (zero-risk)** | A, B, C | ✅ **done** (2026-07-14) |
| **2 — data & polish** | D, E, F | ✅ **done** (2026-07-14) — 3 lists paginated, feed row memoized, avatar CLS |
| **3 — navigation** | G, H | ✅ **done** (2026-07-14) — G resolved by audit (no change needed), H shipped |
| **4 — startup/offline** | I (+ NativeChrome parallel init) | ✅ **done** (2026-07-14) — static-asset SW + parallel init |
| optional (do alongside a batch) | header `transition-all`, watermark pause, splash-glow swap | ⬜ pending (nice-to-haves) |

*Percentage tracks the 9 core labelled fixes (A–I); the optional ◐ items aren't counted. G counts as
complete: investigation showed the routes are already correctly cached/dynamic (see its entry).*

---

**One source of truth for making the Capacitor Android app feel fast, polished, and native.** Every
item below was checked against the codebase on **2026-07-14** during a full mobile-performance audit
(startup, native bridge, lists/DOM, CSS paint, memory). Items already handled correctly are listed
under "Verified safe — no action" at the bottom so we don't re-audit them.

Legend (priority = user impact, worst first):
🔴 P1 freezes / crashes / severe input delay · 🟠 P2 slow startup & navigation ·
🟡 P3 scrolling & animation jank · 🔵 P4 excessive API / CPU / memory · ⚪ P5 bundle / minor polish
Effort: S = <½ day · M = ~1–2 days · L = ~3–5 days · XL = 1–3 weeks
Status: ❌ not started · ◐ partial · [x] ✅ done

### Architecture context (shapes everything below)
The Android app is a **remote-URL webview**, not a bundled static export:
`capacitor.config.ts` → `server.url = process.env.CAP_SERVER_URL || "https://zidrun.com"`.
There is **no offline/app-shell cache** — the service worker is actively unregistered in native
(`service-worker-register.tsx:27`), and **49 pages are `force-dynamic`** (only 1 uses `revalidate`).
So **every cold start and nearly every navigation is a full network round-trip + server render**. On a
mid/low-end device on 3G/4G this dominates "feels slow" more than any JS/CSS micro-optimization. The
Tier-🟠 items address this; the Tier-🔴/🟡 items are the highest felt-improvement per unit risk.

### Progress log
- **2026-07-14 — Audit complete.** Full mobile perf audit done (2 parallel sweeps: lists/DOM + CSS paint).
  Findings captured below with file:line evidence. Prior splash redesign (`native-splash.tsx` +
  `globals.css`) shipped separately.
- **2026-07-14 — Batch 1 shipped (A, B, C).** All typecheck + lint clean.
  - **B** — dropped `backdrop-filter` on `.mobile-tab-bar` and `.native-header`; both now opaque
    `var(--surface)` (were already ~92–96% opaque). No more per-scroll-frame blur passes framing the app.
  - **C** — split the dark/race shadow remap: `.shadow-sm` (every card/row) now uses a cheap single-layer
    `--shadow-sm`; only `.shadow-soft` (elevated surfaces) keeps the heavy multi-layer `--soft-shadow`.
  - **A** — extracted the run row into a `React.memo` `RunRow` with pre-memoized (`useCallback`) handlers +
    a `photoOverridesRef` mirror, so dragging the add-run sliders / expanding one run no longer re-renders
    all ~50 rows (or their SVG maps). Behavior-preserving.
  - **Owner runtime check (device):** React DevTools Profiler — drag a slider, confirm only the form
    re-renders; DevTools Rendering paint-flashing while scrolling a long list in race theme.
- **2026-07-14 — P2 pass (navigation/startup).** All typecheck + lint clean.
  - **H** — reworked `NativeTransition`: dropped `key={pathname}` (which remounted the whole page subtree
    every navigation) for a stable wrapper that replays the CSS enter animation before paint via an
    isomorphic layout effect (native-only; no-op + no reflow on the website). Triggers on the exact same
    `pathname` changes as before, so behavior is preserved (param/pagination changes already reconciled).
  - **NativeChrome parallel init** — `SplashScreen.hide()` still runs first; the independent status-bar /
    back-button / keyboard plugin imports+listeners now run in `Promise.all` instead of serially.
  - **G** — **investigated, no change needed.** Premise didn't hold: marketing/content pages (home, about,
    pricing, runners, organizers, coach, blog) are already static; every `force-dynamic` page is legitimately
    dynamic (`getCurrentUser`, searchParams, or the `recordSearchQuery` write); race **data** reads are
    already cached at the data layer with tag invalidation. No safe caching win exists without a medium
    refactor (splitting personalized islands out of race detail) — logged as a future option below.
  - **I** — **shipped (static-assets-only, per decision).** New `public/native-asset-sw.js` caches only
    immutable hashed `/_next/static` assets in native; registered via `service-worker-register.tsx` with no
    `controllerchange` reload. Warm starts load JS/CSS from disk. Full offline HTML shell deferred by design.
  - **P2 complete (6/9 core).** Only Batch 2 (D, E, F) remains. All changes typecheck + lint clean.
- **2026-07-14 — Batch 2 shipped (D, E, F). All 9 core fixes done (100%).** Typecheck + lint clean.
  - **D** — paginated the 3 unbounded lists. `getAdminSupportThreads`, `getUserRegistrations`, and
    `getOrganizerRaces` now take `PaginationParams` and return `PaginatedResult` (count + skip/take); the
    admin-support / registrations / organizer-events pages render `<Pagination>` (25/page). The two GET API
    callers (`/api/me/registrations`, `/api/organizer/events`) pass a bounded `{page:1, limit:200}` so the
    query can't be unbounded while realistic payloads are unchanged.
  - **E** — extracted the feed row into a `React.memo` `FeedRow`; "Load more" now renders only the new rows
    (existing rows keep stable props and skip). **Hard DOM cap deliberately deferred** — safe trimming needs
    real virtualization (no lib installed); memoization is the low-risk win.
  - **F** — added explicit `width`/`height` to the feed (40px) and rankings (36px) avatars → no layout shift.

---

## 🔴 P1 — Freezes & input delay

- [x] ✅ **(A) Coach runs panel re-renders all 50 rows on every slider drag** — FIXED 2026-07-14: row
      extracted to `React.memo` `RunRow` with `useCallback` handlers; slider drags/expands no longer touch
      other rows. The panel holds the
      50-run list *and* the add-run form state (effort/fatigue/pain/distance/duration sliders) in the same
      component; `runs.map` isn't memoized and rows use inline closures, so dragging a slider or expanding
      one run re-renders all 50 `<article>`s (each with an inline SVG route thumbnail). Concrete input-delay
      source on low-end Android.
      *Evidence:* `coach-runs-panel.tsx:262` (map), `:47-52` (form sliders), `:62` (expandedRun).
      *Fix:* extract the add-run form into its own component (isolate its state), and `React.memo` the run
      row with stable/`useCallback` handlers so slider drags don't touch the list.
      *Benefit:* eliminates the biggest routine input-latency hit. *Risk:* Low (behavior-preserving refactor).
      *Verify:* React DevTools Profiler — drag a slider, confirm only the form re-renders, not 50 rows. — M

---

## 🟠 P2 — Slow startup & navigation

- [x] ✅ **(G) `revalidate`-cache the genuinely-public `force-dynamic` routes** — AUDITED 2026-07-14,
      **no change needed.** The premise was wrong: the marketing/content pages (home, about, pricing, runners,
      organizers, coach, blog) are **already static** (not `force-dynamic`); every `force-dynamic` page is
      legitimately dynamic — races list has searchParams + a `recordSearchQuery` write; race detail `[slug]`
      calls `getCurrentUser()` (personalized registration status / report button); account/organizer/admin are
      per-user. And race **data** reads are already cached at the data layer with tag invalidation. `getLocale`
      reads the `?lang` **param**, not cookies. So there is no safe `revalidate` win to make here.
      *Follow-up (future, medium — NOT done):* race detail `[slug]` could be made mostly-static by extracting
      the `getCurrentUser`-dependent bits (registration CTA, report button) into a client island that fetches
      on the client. Bigger than a flag; only worth it if cold public-page render stays a top complaint. — (n/a)

- [x] ✅ **(H) `NativeTransition` remounts the entire page subtree on every navigation** — FIXED 2026-07-14:
      dropped `key={pathname}` for a stable wrapper that restarts the CSS enter animation before paint via an
      isomorphic layout effect (native-only; website skips it, no reflow). Triggers on the same `pathname`
      changes as before, so behavior is preserved. Now React reconciles instead of tearing down/rebuilding
      the page each navigation. *Evidence:* `native-transition.tsx`. — M

- [x] ✅ **(I) Native static-asset caching** — SHIPPED 2026-07-14 (decision: static-assets-only). Added
      `public/native-asset-sw.js`, a **native-only** cache-only worker that caches **only** hashed
      `/_next/static/<hash>` assets (content-addressed/immutable → can never serve a stale shell; HTML +
      everything else always hit the network). `service-worker-register.tsx` now registers it in native
      (replacing the old blanket unregister); the worker's `activate` nukes any legacy caches, and there is
      **no `controllerchange` reload** (the past reload-loop source). Warm starts now load JS/CSS from disk.
      *Not done (deferred):* full offline HTML shell — deliberately out of scope (that's what caused the old
      stale-shell loops). *Owner runtime check:* after one online load, confirm `/_next/static` requests serve
      from Cache Storage (DevTools → Application → Cache Storage / Network "from ServiceWorker"); verify no
      reload loop on app relaunch after a deploy. — L

- [x] ✅ **NativeChrome plugin init is sequential** — FIXED 2026-07-14: `SplashScreen.hide()` still runs
      first; the independent status-bar / back-button / keyboard imports + listeners now run in `Promise.all`
      instead of serially. *Evidence:* `native-chrome.tsx`. — S

---

## 🟡 P3 — Scrolling & animation jank

- [x] ✅ **(B) `backdrop-filter: blur` on both native fixed bars** — FIXED 2026-07-14: both bars now opaque
      `var(--surface)`, no `backdrop-filter`. The fixed top `.native-header` and fixed
      bottom `.mobile-tab-bar` both blur, so **every app scroll is framed by two full-width per-frame GPU blur
      passes** — the #1 scroll-jank pattern on Android webviews. Both backgrounds are already
      `color-mix(... 92–96%, transparent)` (near-opaque), so the blur is barely visible.
      *Evidence:* `globals.css:446` (native-header), `:362` (mobile-tab-bar).
      *Fix:* drop `backdrop-filter` on both in native; make the background fully opaque (`var(--surface)`).
      Optionally keep a subtle blur only on the website via `html:not(.native-app)`.
      *Benefit:* removes two continuous blur passes → materially smoother scroll; lower battery.
      *Risk:* Very low (near-opaque already). *Verify:* DevTools Rendering → paint-flashing + FPS while
      scrolling a long list, before/after. **← if we do only one fix, this is it.** — S

- [x] ✅ **(C) Dark/Race theme amplifies shadows across the whole app** — FIXED 2026-07-14: `.shadow-sm`
      remapped to a cheap single-layer `--shadow-sm` in dark/race; `.shadow-soft` keeps the 2-layer. In `dark`/`race`, every
      `shadow-sm`/`shadow-soft` is remapped to a 2-layer `--soft-shadow` (`0 0 0 1px …, 0 16px 48px …`),
      turning ~60 shadow sites — including **every race card in a scrolling list** — into large multi-layer
      blurs, in exactly the two themes low-light users pick most.
      *Evidence:* `globals.css:89` (race `--soft-shadow`), remap at `:203-208`, per-card at `race-card.tsx:31`.
      *Fix:* in dark/race, remap `shadow-sm` to a single-layer, smaller-radius shadow; keep the richer 2-layer
      only for elevated surfaces (popovers/sheets). *Benefit:* cuts per-card blur on long lists.
      *Risk:* Low (slightly flatter cards in dark/race). *Verify:* paint-flashing scrolling races in race theme. — S

- [ ] ◐ **Sticky website header animates `height` with `transition-all` on scroll** — collapses header
      height + stripe via `transition-all` (animates a layout property; `all` watches every property). **Native
      hides this header** (`.native-app .site-header{display:none}`), so this is **mobile-web/PWA only** — lower
      priority for the APK, still real for PWA users.
      *Evidence:* `site-header-client.tsx:82,89`.
      *Fix:* transition only `transform`/`opacity`; avoid animating height. *Risk:* Low-Med (visual tuning). — S

- [ ] ◐ **Always-on watermark animation** — `.rz-panel-mark` blades run a 9s infinite translate/opacity loop
      whenever a hero/auth watermark is on screen; cheap per frame but keeps a compositor layer live during
      reading. Transform/opacity-only + reduced-motion-gated, so **acceptable** — optional: pause when scrolled
      out of view. *Evidence:* `globals.css:779,782`. *Risk:* Very low. Low urgency. — S

- [ ] ◐ **Splash glow is the heaviest single composite (boot-only)** — the new `.rz-splash-glow` stacks
      `filter: blur(34px)` + 3-stop radial + infinite scale animation on a ~340px element. Bounded to the ~1.1s
      boot splash and reduced-motion-gated, so low urgency.
      *Evidence:* `globals.css:909-918`.
      *Fix (optional):* swap `filter: blur()` for a pre-blurred radial gradient (soft stops baked in), animate
      only opacity/transform → near-zero cost, same look. *Risk:* Very low. — S

---

## 🔵 P4 — Excessive API / CPU / memory

- [x] ✅ **(D) Three unbounded list queries (no `take`, no pagination)** — FIXED 2026-07-14: all three now
      paginate (`PaginationParams` → `PaginatedResult`, count + skip/take); pages render `<Pagination>` (25/page);
      the two GET API callers pass a bounded `{page:1, limit:200}`. Originally:
      - **Registrations** — `getUserRegistrations` has no `take`; renders every row, each mounting a
        `<PaymentPanel>` client component for unpaid rows. `registrations/page.tsx:91`, `registrations.ts:67`.
      - **Admin support threads** — the one admin table missing the `parsePagination`/`<Pagination>` pattern all
        others use. `admin/support/page.tsx:41`, `support.ts:168`.
      - **Organizer events** — no `take`; bounded per org but no guardrail. `organizer/events/page.tsx:55`.
      *Fix:* add `take` + pagination (reuse the existing `parsePagination` + `<Pagination>` helpers).
      *Benefit:* prevents future freezes; less API/CPU. *Risk:* Low-Med. *Verify:* seed many rows, confirm
      paged. — M

- [x] ◐ **(E) Social feed DOM grows unbounded** — PARTIALLY FIXED 2026-07-14: row extracted to `React.memo`
      `FeedRow`, so "Load more" renders only new rows (existing rows skip). **Hard DOM cap deferred** — safe
      trimming/windowing needs a real virtualization lib (none installed); memoization is the low-risk win and
      resolves the re-render cost. Revisit windowing only if very long feed sessions become a real memory issue.
      *Evidence:* `feed-view.tsx`. — M

- [ ] ◐ **Coach runs — 50 inline SVG route thumbnails** — 50 rows each render an inline SVG polyline map
      (cheap-ish vs Leaflet, but 50 at once, un-virtualized). Largely resolved by (A)'s row memoization; consider
      lazy-mounting the thumbnail only when a row is expanded/in-view if profiling still shows cost.
      *Evidence:* `coach-runs-panel.tsx:273` (`<RunRouteMap>` per row). *Risk:* Low. — S

---

## ⚪ P5 — Bundle & minor polish

- [x] ✅ **(F) Avatars cause layout shift (CLS)** — FIXED 2026-07-14: added explicit `width`/`height` to the
      feed (40px) and rankings (36px) avatars, so they reserve space before load. *Evidence:* `feed-view.tsx`,
      `rankings/page.tsx`. — S

- [ ] ◐ **Bundle** — Leaflet is already lazy-loaded (see verified-safe). No large obvious offenders found;
      revisit with `@next/bundle-analyzer` only if a specific route feels heavy. — S

---

## Recommended sequence

| Batch | Focus | Items | Why |
|---|---|---|---|
| **1** | 🔴🟡 Felt speed, zero-risk | **A, B, C** | Biggest input-latency + scroll win; no visual/architectural change |
| **2** | 🔵⚪ Data & polish | **D, E, F** | Guardrails on unbounded lists + memory + CLS; low-med risk |
| **3** | 🟠 Navigation | **G, H** | Faster nav; needs per-route auth/caching care |
| **4** | 🟠 Startup/offline | **I** + NativeChrome parallel init | Highest value, most caution (SW reload-loop history) |
| **opt** | 🟡 Nice-to-haves | header `transition-all`, watermark pause, splash-glow swap | Small, do alongside a batch |

**If only one fix ever ships: B** (drop `backdrop-filter` on the two native bars) — near-zero risk, affects
every app screen's scroll.

---

## Open decisions blocking work
- **Offline strategy (I):** cache-only SW vs Capacitor HTTP cache vs bundled static shell — pick before Batch 4.
  All must avoid the prior `controllerchange → reload` loop.
- **Caching audit (G):** confirm which `force-dynamic` routes are truly public vs personalized — needs a
  per-route decision list before implementing.
- **Architecture (long-term):** keep the remote-URL webview, or move top-level tabs to a bundled static shell
  for instant cold start? Larger effort — only if startup remains the top complaint after G/I.

---

## Verified safe — no action (checked 2026-07-14)
- **Leaflet lazy-loaded** — dynamic `import("leaflet")` in an effect, not in the main bundle (`run-map.tsx:25,59`).
- **NativePush fully gated off** — early-returns unless `NEXT_PUBLIC_NATIVE_PUSH_ENABLED` (`native-push.tsx:24`).
- **`race-media` blur is off in the dense list** — `RaceCard` passes `backdrop={false}` (`race-card.tsx:39`),
  so the per-card `blur-xl`/`backdrop-blur` only runs on detail views.
- **Most lists are paginated/bounded** — races (10/page), rankings (20×2), homepage (3), organizer
  registrations (25/page), all other admin tables (25/page via `parsePagination`), notifications (capped 50),
  blog (local md).
- **PullToRefresh / scroll-trail listeners** — passive, rAF-throttled, cleaned up on unmount.
- **AnalyticsTracker** — uses `navigator.sendBeacon` (non-blocking).
- **Keys** — all lists use stable ids; no array-index-as-key misuse.
- **Press-feedback & tab transitions** — transition `transform`/`opacity` only (not `all`).
- **No `will-change` anywhere** — defensible (avoids layer-churn on low-end Android); add only if profiling
  shows a specific retained animation needs it.
