# ZidRun — Mobile Performance Execution Plan (verified)

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
- **2026-07-14 — Audit complete, no code changes yet.** Full mobile perf audit done (2 parallel sweeps:
  lists/DOM + CSS paint). Findings captured below with file:line evidence. Prior splash redesign
  (`native-splash.tsx` + `globals.css`) shipped separately. Recommended start: **A, B, C** (input latency
  + scroll smoothness, zero visual/architectural change).

---

## 🔴 P1 — Freezes & input delay

- [ ] ❌ **(A) Coach runs panel re-renders all 50 rows on every slider drag** — the panel holds the
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

- [ ] ❌ **(G) `revalidate`-cache the genuinely-public `force-dynamic` routes** — 49 `force-dynamic` pages,
      1 `revalidate`. Public listing/content routes (races list, race detail, pricing, about, blog) pay a full
      server render on every navigation with no HTTP cache. Personalized routes (account/coach/admin/organizer)
      must stay dynamic.
      *Evidence:* `grep force-dynamic src/app` → 49 files; only 1 `export const revalidate`.
      *Fix:* per-route audit → switch the truly-public ones to `revalidate = N` (or segment caching) so
      repeat navigations hit cache. *Benefit:* near-instant public-page nav; lower server load.
      *Risk:* Medium — must not cache authenticated/personalized data; route-by-route pass required.
      *Verify:* Network panel — cached routes return from-cache / low TTFB; personalized pages still update. — M

- [ ] ❌ **(H) `NativeTransition` remounts the entire page subtree on every navigation** — wraps all routes
      and re-keys on pathname (`<div key={pathname}>`), forcing a full DOM teardown+rebuild (image reloads,
      re-layout) each nav just to replay a CSS enter animation, instead of letting React reconcile.
      *Evidence:* `native-transition.tsx:11`.
      *Fix:* replay the enter animation via a class toggle on pathname change (effect), or scope the `key` to a
      small inner wrapper — keep the visual transition, drop the full remount.
      *Benefit:* cheaper, faster route transitions. *Risk:* Low-Medium (preserve animation + scroll reset).
      *Verify:* Performance trace on nav — compare scripting/layout time and DOM node churn. — M

- [ ] ❌ **(I) No offline/app-shell asset caching in native** — remote-URL load + SW unregistered means a
      flaky connection = blank/slow app, and hashed static assets (JS/CSS/font) re-fetch instead of loading
      from disk.
      *Evidence:* `service-worker-register.tsx:27-33`; `images:{unoptimized:true}` in `next.config.ts`.
      *Fix (graduated):* (1) native-safe cache-only SW (or Capacitor HTTP cache) for `/_next/static/*` + font —
      **must avoid** the `controllerchange → reload` loop the code comment warns about (no navigation preload,
      no reload). (2) later: bundled static shell for the top-level tabs.
      *Benefit:* faster warm starts, resilience on poor networks. *Risk:* Med-High (SW in this webview has
      caused reload loops before — scope carefully, native-only). *Verify:* airplane-mode after first load. — L

- [ ] ◐ **NativeChrome plugin init is sequential** — `SplashScreen.hide()` is awaited first (good), but
      status-bar / app / keyboard dynamic imports then run one-after-another in the same async IIFE.
      *Evidence:* `native-chrome.tsx:43-83`.
      *Fix:* `Promise.all` the independent plugin imports/listeners after the splash hide. *Benefit:* shaves a
      little bridge/boot time. *Risk:* Very low. *Verify:* boot trace, time-to-interactive. — S

---

## 🟡 P3 — Scrolling & animation jank

- [ ] ❌ **(B) `backdrop-filter: blur` on both native fixed bars** — the fixed top `.native-header` and fixed
      bottom `.mobile-tab-bar` both blur, so **every app scroll is framed by two full-width per-frame GPU blur
      passes** — the #1 scroll-jank pattern on Android webviews. Both backgrounds are already
      `color-mix(... 92–96%, transparent)` (near-opaque), so the blur is barely visible.
      *Evidence:* `globals.css:446` (native-header), `:362` (mobile-tab-bar).
      *Fix:* drop `backdrop-filter` on both in native; make the background fully opaque (`var(--surface)`).
      Optionally keep a subtle blur only on the website via `html:not(.native-app)`.
      *Benefit:* removes two continuous blur passes → materially smoother scroll; lower battery.
      *Risk:* Very low (near-opaque already). *Verify:* DevTools Rendering → paint-flashing + FPS while
      scrolling a long list, before/after. **← if we do only one fix, this is it.** — S

- [ ] ❌ **(C) Dark/Race theme amplifies shadows across the whole app** — in `dark`/`race`, every
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

- [ ] ❌ **(D) Three unbounded list queries (no `take`, no pagination)** — will degrade as data grows:
      - **Registrations** — `getUserRegistrations` has no `take`; renders every row, each mounting a
        `<PaymentPanel>` client component for unpaid rows. `registrations/page.tsx:91`, `registrations.ts:67`.
      - **Admin support threads** — the one admin table missing the `parsePagination`/`<Pagination>` pattern all
        others use. `admin/support/page.tsx:41`, `support.ts:168`.
      - **Organizer events** — no `take`; bounded per org but no guardrail. `organizer/events/page.tsx:55`.
      *Fix:* add `take` + pagination (reuse the existing `parsePagination` + `<Pagination>` helpers).
      *Benefit:* prevents future freezes; less API/CPU. *Risk:* Low-Med. *Verify:* seed many rows, confirm
      paged. — M

- [ ] ❌ **(E) Social feed DOM grows unbounded** — feed accumulates pages into state and **never trims**, so
      node count climbs indefinitely as you "Load more"; rows aren't memoized.
      *Evidence:* `feed-view.tsx:159` (map), `:134` (`setRuns([...prev, ...])`).
      *Fix:* cap retained pages (windowing) or trim off-screen rows; `React.memo` the row.
      *Benefit:* bounded memory on long feed sessions. *Risk:* Med (scroll-position preservation). — M

- [ ] ◐ **Coach runs — 50 inline SVG route thumbnails** — 50 rows each render an inline SVG polyline map
      (cheap-ish vs Leaflet, but 50 at once, un-virtualized). Largely resolved by (A)'s row memoization; consider
      lazy-mounting the thumbnail only when a row is expanded/in-view if profiling still shows cost.
      *Evidence:* `coach-runs-panel.tsx:273` (`<RunRouteMap>` per row). *Risk:* Low. — S

---

## ⚪ P5 — Bundle & minor polish

- [ ] ❌ **(F) Avatars cause layout shift (CLS)** — feed & rankings avatars are raw `<img loading="lazy">`
      with **no width/height** (only CSS `size-9`/`size-10`), so they shift layout before load.
      *Evidence:* `feed-view.tsx:54`, `rankings/page.tsx:164`.
      *Fix:* add explicit `width`/`height` (or `aspect-ratio`). *Risk:* Very low. — S

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
