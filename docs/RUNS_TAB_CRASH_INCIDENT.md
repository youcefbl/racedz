# Incident — Runs tab crash from a stuck GPS recording

**Reported:** 2026-07-26 · **Fixed:** 2026-07-27 · **Severity:** high (one runner fully locked out
of `/account/runs` in the native app; same class of bug could hit any runner who leaves a
recording running)

---

## Symptom

A runner reported: while doing a guided interval run, they used the "skip step" button a few
times, then later opened the app and got a generic error screen —
**"We couldn't load your account" / Something went wrong loading this page"** — specifically on
the **Runs** tab. Races, Coach, and Account tabs all loaded fine. Logging out and back in did not
fix it. "Try again" on the error screen did nothing.

The runner also reported (after further digging) that the app was **still recording a run 3 hours
later, showing ~60 km covered** — after they had put the phone down and driven somewhere by car.

## Investigation

Two lines of investigation ran in parallel before the real cause was found:

1. **DB-side check** — queried the runner's `RunnerRun` history in prod for anomalous rows
   (impossible pace, `movingTimeSeconds > durationSeconds`, malformed `route`/`photos` JSON). One
   genuinely bad historical row turned up, but nothing in the server-side data path
   (`getRunsScreenData` → `computePersonalRecords` / `computeBadges`) actually throws on that kind
   of bad data — so this was a red herring, not the cause.
2. **Client-side (native) check** — the fact that the identical account loaded fine in a mobile
   *browser* but crashed only inside the **native Android app** ruled out anything server-rendered
   (an SSR crash would fail identically in both). That pointed at native-only client state.

### Root cause

`runEngine` (`src/lib/native/run-engine.ts`) is a module-level singleton that keeps the GPS watcher
alive independent of navigation, by design — leaving the Runs tab must not stop an in-progress
recording. It persists a snapshot to `Capacitor Preferences` every 4s
(`src/lib/native/run-store.ts`, key `zidrun:active-run`) so a crash/kill doesn't lose the run.
That storage is **device-local and independent of the auth session** — which is why logging out
and back in had no effect.

The guided run was left in `"tracking"` status (never explicitly finished), so the GPS watcher
kept accepting fixes for 3 hours, including ordinary car-driving speed (any two fixes 1–60 m apart
are accepted as "moving"). On the next Runs-tab mount, `RunRecorder` called `runEngine.init()`,
which loaded that 3‑hour/60 km snapshot and tried to resume it — and something in that resume path
threw. Since the bad snapshot was still sitting in `Preferences`, every retry (and every future
visit to Runs) hit the same throw — explaining why "Try again" never helped.

This also explained why **Coach** loaded fine: `RunRecorder` only mounts there when the user
switches to the Coach dashboard's "runs" sub-view (not the default view), so the crashing resume
path was never triggered on that page.

## Fix

**1. Guard against resuming an implausible/stale recording** — `src/lib/native/run-engine.ts`
   - A persisted snapshot is now rejected (cleared instead of resumed) if it's **older than 6
     hours** (abandoned session) or implies a sustained average moving speed **> 7 m/s (~25 km/h)**
     — well past any real running pace, which catches exactly this car-while-recording case.
   - `restoreFrom()` is wrapped in try/catch so any *other* malformed snapshot also clears instead
     of propagating a throw.
   - The recorder shows a one-time "we discarded an abandoned recording" notice
     (`discardedStaleRun` state, new copy in all 3 locales) instead of silently vanishing.

**2. Scope the blast radius of any future crash** — `src/components/ui/error-boundary.tsx`
   - New reusable `ErrorBoundary` class component wraps `<RunRecorder>` in
     `src/components/coach/coach-runs-panel.tsx`. If the recorder throws for any other reason, only
     that card shows a fallback (with a "Clear and reload" button that wipes the stuck snapshot),
     instead of the whole Runs/Coach page dying via the route-level `error.tsx`.

**3. Client crash reporting to the DB** — so this class of bug is diagnosable without SSH + psql:
   - New `ClientErrorLog` Prisma model + migration
     (`prisma/migrations/20260727002829_add_client_error_log`).
   - `POST /api/client-errors` (`src/app/api/client-errors/route.ts`) — public, rate-limited,
     fail-soft 204, mirrors the existing `/api/track` analytics-beacon pattern.
   - `src/lib/client-error-report.ts` — `sendBeacon`-with-`fetch`-fallback reporter, wired into
     both the route-level `RouteError` boundary and the new `RunRecorder` `ErrorBoundary`, so every
     crash (page-level or scoped) lands in the table alongside Sentry.

**4. Admin visibility** — `/admin/errors` (nav: "Client errors")
   - `src/lib/client-errors.ts` — paginated reader with filters (message/route search, boundary,
     platform) and stats (total, last 24h, distinct routes).
   - `src/app/admin/errors/page.tsx` — stat cards, filter bar, per-row stack trace (collapsible),
     reporter attribution, "Dismiss" (per-row) and confirm-guarded "Clear all", both audit-logged.

## Files changed

```
prisma/schema.prisma                                          (+ClientErrorLog model)
prisma/migrations/20260727002829_add_client_error_log/
src/lib/native/run-engine.ts                                  (resume sanity guard)
src/components/coach/run-recorder.tsx                         (discardedStaleRun banner)
src/components/coach/copy.ts                                  (+3 locale keys × 2 usages)
src/components/coach/coach-runs-panel.tsx                     (ErrorBoundary wrap + fallback)
src/components/ui/error-boundary.tsx                          (new)
src/components/ui/route-error.tsx                             (reports to /api/client-errors too)
src/lib/client-error-report.ts                                (new)
src/app/api/client-errors/route.ts                             (new)
src/lib/client-errors.ts                                      (new, admin reader)
src/app/admin/errors/{page,actions,clear-all-button}.tsx       (new)
src/components/layout/dashboard-shell.tsx                      (+nav item)
```

## Immediate remedy for the affected user

Android Settings → Apps → ZidRun → Storage & cache → **Clear storage** (not just cache) — wipes
the stuck `zidrun:active-run` snapshot. No server-side data is affected; the app fix above prevents
recurrence going forward without needing this manual step.

## Verification

- `npm run typecheck`, `npm run lint` (incl. i18n parity check), `npm run build` all pass.
- Migration applied cleanly to a local dev DB; `getAdminClientErrors` / stats / boundary-filter
  queries verified directly.
- `/admin/errors` driven end-to-end in a real headless-browser session (login → list → expand
  stack trace → filter by boundary → dismiss a row) — confirmed visually and against the DB.

## Follow-ups (not done, not blocking)

- No retention/prune job for `ClientErrorLog` yet (see comment on the model) — prune manually if it
  grows large, or add a cron mirroring `scripts/prune-pageviews.ts` later.
- The dead `recoverTitle`/`recoverText`/`recoverResume`/`recoverDiscard` copy keys in `copy.ts`
  (unused, likely leftover from an earlier resume-confirmation design) were left untouched — out of
  scope for this fix.
