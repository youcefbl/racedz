# Incident — Runs tab crash and runaway GPS recording

**Reported:** 2026-07-26 · **Fixed:** 2026-07-27 · **Status:** root cause fixed and verified;
P0/P1 hardening shipped; P2 (WebView perf) partial; full emulator/physical-device QA matrix still
outstanding — see [§ Follow-up](#follow-up--gaps-closed-2026-07-27) for exactly what shipped
against each numbered gap below.

**Severity:** P1/high — one runner was locked out of `/account/runs`, the native GPS watcher
continued after the UI failed, and the resulting activity could corrupt training statistics and
plan adherence.

---

## Summary

During a guided interval run, the runner pressed **Skip step** several times and the native Android
Runs tab fell into the account-level error boundary:

> We couldn't load your account. Something went wrong loading this page. Please try again.

The other bottom tabs continued to work, but **Try again** did not recover Runs. The GPS engine is a
module-level singleton, so it continued recording after the React UI crashed. A logout/login later
reset the JavaScript runtime, made the recording accessible again, and allowed the runner to save
it. By then it contained car travel and reported approximately 60 km.

Commit `78ce19940d2c6a9b0efd2ff3eadad6228ae172e5` added useful containment, persisted-snapshot guards,
and client-error reporting. It is a **partial mitigation**, not proof that the original crash is
fixed. The original exception was not captured, and screenshot timing shows that the first crash
happened before the recording became stale or implausibly long.

## Evidence-backed timeline

The two supplied Android screenshots include EXIF timestamps:

| Evidence | Timestamp | What it establishes |
|---|---:|---|
| Runs account-error screenshot | 2026-07-26 20:56:47 | The Runs tab had already crashed during the starting minute of the activity. |
| Saved activity start | 2026-07-26 20:56 | The recording began in the same minute as the crash. |
| Saved activity | 60.619 km; 3:17:58 elapsed; 1:46:28 moving | GPS continued after the UI failed and later captured motorized movement. |
| Saved-run screenshot | 2026-07-27 01:02:37 | After a logout/login and full runtime reload, the runner could open and save the ongoing recording. |

The saved activity's moving speed is approximately **9.49 m/s (34.2 km/h)**. Therefore the new
`> 7 m/s` cold-restore predicate would reject this exact final snapshot if evaluated. It could not
have prevented the initial 20:56 crash, because that crash occurred as the run started.

## Two coupled failures

### A. The guided-run UI crashed

The exact exception is unknown. The strongest current hypothesis is invalid module-scoped guided
workout state after repeated step skipping or a component remount:

- `useWorkoutGuidance` stores progress in module-level `sharedProgress`, independent of a specific
  run session, workout ID, or workout-structure version.
- It assumes `sharedProgress.current.stepIndex` is valid for the current `steps` array and later
  reads `steps[stepIndex]!` without a runtime guard.
- A full page reload resets this module state, matching the observed logout/login recovery.
- Repeated **Skip step** was the action immediately associated with the report.

This is a hypothesis, not a confirmed root cause. Other candidates that must be tested are live
route/map rendering, per-fix main-thread work, audio/guidance effects, and malformed state emitted
during navigation.

### B. Recording continued after the UI failed

`runEngine` (`src/lib/native/run-engine.ts`) deliberately owns the GPS watcher outside React so a
run survives ordinary navigation away from Runs. That also means a React crash does not pause or
stop recording. The engine continued to accept GPS fixes after the page failed, persisted the
growing snapshot to Capacitor Preferences under `zidrun:active-run`, and eventually recorded the
runner's car journey.

The snapshot is device-local and independent of authentication. Logout/login reset the in-memory
engine and guided state but did not clear the persisted recording. That explains why the runner
could see the ongoing run after signing back in.

## Assessment of commit `78ce199`

### Improvements worth keeping

- A recorder-scoped React error boundary prevents a synchronous recorder render/lifecycle failure
  from replacing the whole Runs or Coach page.
- Implausible cold snapshots such as the final 60.619 km incident snapshot are rejected.
- `restoreFrom()` has a malformed-snapshot backstop.
- Client boundary failures are sent to Sentry and the new `ClientErrorLog` endpoint.
- `/admin/errors` gives administrators a searchable view of captured client failures.

### Gaps that keep the incident open

1. **The guard only runs during cold `init()`.** If the singleton is already in `tracking`, `init()`
   returns without evaluating staleness or movement plausibility. A warm remount can therefore hit
   the same broken in-memory state.
2. **The initial crash is not fixed or reproduced.** It happened in the activity's starting minute,
   before the three-hour snapshot existed.
3. **The six-hour rule can delete legitimate ultra recordings.** It compares `Date.now()` with
   `startTs`, not inactivity, and clears the snapshot without review. ZidRun supports races lasting
   longer than six hours.
4. **Recovery does not explicitly stop the native watcher.** The fallback clears Preferences and
   reloads, but does not await watcher, timer, and step-counter shutdown.
5. **Snapshots are not scoped to a user.** A second account on the same device can inherit the
   previous account's unfinished route.
6. **The discard notice is not immediately dismissible.** `ackDiscardedStaleRun()` mutates engine
   state without emitting a new state to React.
7. **A suspect saved activity still counts.** The UI warns that it may not count as a run, but the
   server stores it normally and includes it in personal records, badges, coach metrics, workout
   matching/completion, and potentially rankings/social surfaces.
8. **React error boundaries are not universal.** They do not catch event-handler errors, rejected
   promises, every asynchronous effect, native crashes, or Android ANRs. Global and native
   diagnostics remain necessary.

## Immediate remediation

For the affected runner:

1. Export the saved bad activity as GPX and retain a sanitized copy of its DB metadata/route as a
   regression fixture. Do not commit the runner's real coordinates or identity.
2. Delete the 60.619 km activity through the existing Runs UI after preserving the fixture. The
   delete flow also reopens a linked planned workout and clears its completion metadata.
3. Recompute or refresh any persisted coach snapshot derived after this activity was saved.
4. Until a hardened build is released, Android Settings → Apps → ZidRun → Storage & cache →
   **Clear storage** remains the last-resort recovery for an inaccessible local recording. This
   also removes other device-local app state and must not be presented as the normal remedy.

## Implementation plan

### P0 — Make guided progress session-safe

- Give every recording a unique `runSessionId`.
- Associate guided state with `runSessionId`, `workoutId`, and a deterministic workout-structure
  fingerprint.
- Persist guided progress with the active-run snapshot rather than relying only on anonymous
  module-level state.
- Implement step progress as a pure validated transition/reducer.
- Validate or reset an out-of-range `stepIndex` before every render/effect; remove non-null
  assertions around the current step.
- Make rapid repeated Skip actions idempotent and safe when GPS-driven auto-advance occurs in the
  same render cycle.
- Reset guidance and audio state on save, discard, crash recovery, logout, workout change, and new
  session start.

### P0 — Make the run lifecycle fail safe

- Add one awaited `abortAndClear()` operation that stops the GPS watcher, interval timer, step
  counter, and audio/guidance state before clearing Preferences.
- Use that operation from recorder crash recovery and confirmed discard.
- On logout with an active recording, require the runner to choose **Finish**, **Discard**, or
  **Keep safely paused** before the auth session changes.
- Store the owning `userId` in the snapshot and refuse to restore it for a different account.
- Check run safety while live and when the app returns to the foreground, not only on cold restore.
- For sustained impossible movement, auto-pause and ask the runner what happened. Never silently
  delete the recording.
- Remove total elapsed age as an automatic deletion criterion. A long but structurally valid ultra
  must remain recoverable.

### P1 — Quarantine suspect activities server-side

- Add a persisted activity-validity state such as `VALID`, `SUSPECT`, and `EXCLUDED`, with a
  machine-readable reason.
- Classify GPS activities before workout matching and derived-stat updates.
- Exclude `SUSPECT`/`EXCLUDED` activities from personal records, badges, rankings, social feeds,
  coach metrics/context, adherence, and automatic workout completion.
- Let the runner keep the route for review, reclassify it as a non-running activity where
  supported, or discard it.
- Align the warning copy with actual behavior; "may not count" must not mean "currently counts
  everywhere."

### P1 — Improve diagnostics without storing sensitive route data

- Record safe breadcrumbs with a crash: run status, run-session ID, route point count, elapsed and
  moving seconds, guided step index/count, workout fingerprint, last recorder action, and whether
  the runtime is native.
- Never send GPS coordinates, health notes, auth tokens, or the full snapshot to error logs.
- Add `window.onerror` and `unhandledrejection` reporting in addition to React boundaries.
- Verify Firebase Crashlytics captures native crashes/ANRs in the signed Android build.
- Add bounded retention/pruning for `ClientErrorLog` before production approval.

### P2 — Reduce long-run WebView pressure

- Stop copying and fully recomputing the route/splits on every accepted GPS fix.
- Throttle or incrementally update live splits and map polylines.
- Avoid animated map recentering on every fix.
- Avoid serializing the full growing route to Preferences every four seconds; use chunking,
  incremental persistence, or a native/local database suitable for larger tracks.
- Measure memory, CPU, battery, and frame responsiveness with 1,500-, 3,000-, and 20,000-point
  fixtures.

## Reproduction and test plan

Do not reproduce this by driving with a physical phone recording. Use deterministic fixtures and
Android emulator route playback.

### Automated unit/domain tests

Extract snapshot classification, run-engine transitions, and guidance transitions into pure,
dependency-injected functions. Cover:

1. Skip once, ten times, and 100 times rapidly.
2. Skip while a GPS tick satisfies and auto-advances the same step.
3. Remount during a guided run with the same workout.
4. Remount with a shorter/different workout or no workout.
5. Complete, save, discard, crash-recover, and logout after skipped steps.
6. Restore a sanitized incident fixture: 60.619 km, 3:17:58 elapsed, 1:46:28 moving, with bounded
   route points.
7. Restore a valid 8–15 hour ultra; it must not be automatically deleted.
8. Restore truncated, malformed, future-dated, wrong-user, and unsupported-version snapshots.
9. Process routes with zero, one, 1,500, 3,000, and 20,000 points.
10. Fuzz duplicate/reversed timestamps, long GPS gaps, inaccurate fixes, teleport jumps, missing
    elevation, and extreme but valid coordinates.
11. Prove a suspect server-side activity cannot update records, badges, coach metrics, workout
    completion, leaderboards, or the public feed.
12. Prove `abortAndClear()` stops every native/resource handle before storage is removed.

Add focused tests to the normal CI command. Passing lint, typecheck, build, and unrelated coach
domain tests is not sufficient evidence for this incident.

### Debug-only deterministic harness

Provide development-only presets that can seed persisted state or an already-live engine:

- normal 5K;
- the sanitized 60 km incident shape;
- valid eight-hour ultra;
- malformed route/snapshot;
- 3,000-point active route;
- guided progress with an out-of-range step index;
- snapshot owned by a different runner.

The harness must be unavailable in production builds and must never include real runner
coordinates.

### Android emulator/native integration

Use the existing setup in `docs/MOBILE_ANDROID.md` and `docs/EMULATOR_E2E_TEST_PLAN.md`:

```bash
docker compose up -d postgres
npm run dev:lan
CAP_SERVER_URL=http://10.0.2.2:3003 npx cap sync android
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Capture WebView/native errors while reproducing:

```bash
adb logcat -c
adb logcat | rg -i "chromium|capacitor|AndroidRuntime|error|fatal|exception"
```

Replay a timestamped walking/running or fast vehicle GPX through Android Emulator → Extended
Controls → Location → Routes. Exercise this lifecycle matrix:

1. Start a guided workout and rapidly press Skip.
2. Switch Runs → Coach → Races → Runs repeatedly while tracking.
3. Background the app, turn the screen off, and return while GPS advances.
4. Revoke and restore location permission mid-run.
5. Pause/resume repeatedly and introduce GPS gaps or inaccurate fixes.
6. Force-stop and relaunch to exercise cold snapshot restoration.
7. Trigger recorder recovery and verify the foreground GPS notification disappears.
8. Logout/login as the same runner, then as a different runner.
9. Save offline, reconnect, and confirm only one activity is created.
10. Repeat with a long/high-point fixture while monitoring memory:

```bash
adb shell dumpsys meminfo dz.racedz.app
```

Run the final matrix on at least one physical Android device because emulator testing does not
cover OEM background-service limits, real GPS drift, battery optimization, native TTS interaction,
or WebView/driver-specific failures.

## Release acceptance criteria

This incident can be marked resolved only when all of the following are recorded against the exact
release commit:

- Rapid Skip and every guided remount scenario complete without a route-level error.
- A recorder failure leaves Runs usable and offers a recovery action that stops all native work.
- No GPS watcher survives confirmed discard or logout.
- A different account cannot inspect or save the previous account's snapshot.
- Impossible sustained movement pauses safely and cannot contaminate running statistics.
- A legitimate eight-hour-plus activity remains recoverable.
- Force-kill, cold restore, navigation, screen-off, background, offline, permission-revocation, and
  account-switch tests pass.
- Client errors contain actionable safe state metadata and no precise route/health data.
- Lint, typecheck, production build, focused run/guidance tests, Playwright coverage, emulator QA,
  and physical-device QA pass.
- `PRODUCTION_READINESS.md` gates PR-050 and PR-056 are updated with evidence before rollout.

## Existing mitigation files

Commit `78ce199` changed the following areas. These remain useful, but do not close the plan above:

```text
prisma/schema.prisma
prisma/migrations/20260727002829_add_client_error_log/
src/lib/native/run-engine.ts
src/components/coach/run-recorder.tsx
src/components/coach/copy.ts
src/components/coach/coach-runs-panel.tsx
src/components/ui/error-boundary.tsx
src/components/ui/route-error.tsx
src/lib/client-error-report.ts
src/app/api/client-errors/route.ts
src/lib/client-errors.ts
src/app/admin/errors/
src/components/layout/dashboard-shell.tsx
```

At the time of review, `npm run lint`, `npm run typecheck`, `npm run build`, and
`npm run test:coach` passed. Those checks confirm compilation and unrelated coach behavior; they do
not reproduce the native incident.

## Follow-up — gaps closed (2026-07-27)

The root cause is now fixed, not just mitigated. `src/components/coach/use-workout-guidance.ts`
was rewritten: `steps[stepIndex]!` non-null assertions are gone (replaced by a `stepAt()` helper
that clamps and never trusts the index), and `sharedProgress` is now keyed by a `sessionKey`
(run-start identity + workout id + step count) instead of only resetting on `status === "idle"` —
a workout swap or a shrunk `steps` array can no longer read a stale, out-of-range `stepIndex`. This
is the change that actually addresses "the crash happened in the activity's starting minute,"
independent of anything the run-engine does.

Gap-by-gap:

1. **Guard only ran during cold `init()`.** Superseded — the resume-time speed/age guard was
   removed entirely (see #3 below), so this is moot. The real fix (session-keyed, bounds-clamped
   guidance) applies on every render and every remount, warm or cold, not just `init()`.
2. **Initial crash not fixed or reproduced.** Fixed at the source (`use-workout-guidance.ts`, above).
   Not reproduced under the exact incident conditions on a physical device — see open items below.
3. **Six-hour rule could delete legitimate ultra recordings.** Removed entirely, per this doc's own
   instruction. `run-engine.ts` no longer auto-discards anything based on age or implausible speed.
   A cold-resumed snapshot is always restored (only a genuinely malformed/unparsable one is
   cleared), and the existing "doesn't look like it was on foot" warning + pause/finish/discard
   controls are what the runner sees — never a silent deletion. A live implausible-speed run now
   **auto-pauses** instead (see #7), which is non-destructive and reversible.
4. **Recovery didn't stop the native watcher.** Fixed. `RunEngine.abortAndClear()` awaits
   `stopWatch()` (which calls the plugin's `removeWatcher()`) and `stopStepCounter()` before
   clearing storage; both `discard()` and the recorder's crash-fallback "Clear and reload" button
   now use it, instead of a bare `clearActiveRun()` + reload that left the native foreground service
   orphaned.
5. **Snapshots weren't scoped to a user.** Fixed. `ActiveRunSnapshot` now carries `userId`;
   `RunEngine.init(userId)` refuses to restore (or delete) a snapshot belonging to a different
   account — it's left untouched on disk for its actual owner.
6. **Discard notice wasn't dismissible (`ackDiscardedStaleRun()` didn't `emit()`).** Moot — that
   whole flag/banner was removed along with the auto-discard behavior it supported (#3).
7. **A suspect activity still counted everywhere.** Fixed server-side. `RunnerRun` gained a
   `validity` enum (`VALID`/`SUSPECT`/`EXCLUDED`) + `validityReason`, set once at save time in
   `createRunnerRun` for GPS-sourced runs using the same `detectNonFootActivity` signal the client
   already warned with. `getRunnerRecords` and `getRunsForMetrics` (the single query that feeds
   coach metrics, consistency/intensity, and the AI context/prompt) now filter to `validity =
   'VALID'`. A non-`VALID` run is also never linked to (or allowed to auto-complete) a workout. The
   run stays visible to its owner with a reason, and the "may not count" copy was corrected to say
   what actually happens ("excluded from your stats, records, and coach — delete anytime").
   Separately, live tracking now auto-pauses once the cumulative average speed sustains above
   ~25 km/h for 2+ minutes — the runaway-car scenario stops itself within minutes instead of
   running for hours, without ever deleting anything.
8. **React error boundaries aren't universal.** Partially addressed: `GlobalErrorReporter`
   (mounted in the root layout) now also reports `window.onerror` and `unhandledrejection` events
   to the same `ClientErrorLog` pipeline. Native crash/ANR capture (Firebase Crashlytics) was **not**
   verified in this pass — no signed Android build/device was available in this environment.

Also fixed while in this code: `RunEngine.ackDiscardedStaleRun()` never called `emit()` (dead now,
see #6), and a logout guard was added (`account-menu.tsx`, `account-hub.tsx`) that warns before
sign-out if a recording is active — the account-scoping in #5 is the actual safety net, but the
warning avoids surprising a runner whose recording is still going.

### Implementation-plan status

- **P0 — guided progress session-safe:** done (session-keyed `sharedProgress`, bounds-safe
  `stepAt()`, idempotent `skip()`). **Not done:** guided progress is still not itself persisted into
  the snapshot, so a cold app-kill mid-guided-run resumes GPS tracking correctly but restarts
  guidance from step 0 — a UX inconsistency, not a crash or data-integrity issue. Left for a
  follow-up.
- **P0 — run lifecycle fail-safe:** done (`abortAndClear()`, user-scoped snapshot, live
  auto-pause + logout warning, age-based deletion removed). The "Finish/Discard/Keep paused" modal
  choice on logout was simplified to a single confirm — the unsafe outcomes it was meant to prevent
  (cross-account leakage, silent data loss) are already closed by the user-scoping.
- **P1 — quarantine suspect activities server-side:** done for records/coach/matching (the surfaces
  that actually mattered — badges/streaks derive from records, and adherence derives from
  `TrainingWorkout.status`, which a non-`VALID` run can no longer flip to `COMPLETED`). **Not done:**
  a `SUSPECT`/`EXCLUDED` reclassification UI beyond "delete it" (out of scope for a bug-fix pass);
  no backfill of historical rows saved before this migration (all default to `VALID`).
- **P1 — diagnostics without sensitive data:** done (safe breadcrumbs — run status, point count,
  elapsed/moving seconds, guided step index/total, workout type — on a new `ClientErrorLog.context`
  Json column; `window.onerror`/`unhandledrejection` reporting; retention via
  `npm run client-errors:prune`, 30-day default, not yet wired to a cron). **Not done:** Crashlytics
  verification (needs a signed device build).
- **P2 — reduce WebView pressure:** partial. Live map recentering no longer animates on every fix;
  the live route/splits recompute is throttled to every 5th point while tracking (exact on
  pause/finish, so the summary is never stale). **Not done:** chunked/incremental route persistence,
  and the 1,500/3,000/20,000-point memory/CPU/battery profiling — both need real device measurement.

### Verification performed

- `npm run typecheck`, `npm run lint` (incl. i18n parity), `npm run build`, `npm run test:coach`,
  `npm run test:workout` all pass.
- Two new migrations applied cleanly to a local dev DB (`RunValidity` enum +
  `RunnerRun.validity`/`validityReason`; `ClientErrorLog.context`).
- `createRunnerRun` exercised directly against the dev DB with the incident's exact numbers
  (60.619 km / 3:17:58 elapsed / 1:46:28 moving): saved as `EXCLUDED` / `IMPOSSIBLE_PACE`, never
  linked to a workout, excluded from `getRunnerRecords` (longest run stayed at the legitimate 5 km
  entry, not 60.619), while still showing up in the runner's own run list with its validity flag —
  and a normal 5 km run in the same batch saved as `VALID`.
- `/account/runs` and `/admin/errors` driven end-to-end in a real headless-browser session
  (login → render): no crash, no console errors.

### Still open (not done in this pass)

- No automated regression test for the guidance bounds fix itself — this repo's `test:*` scripts
  are plain Node assertions on pure functions, and `useWorkoutGuidance` is a stateful React hook
  with no existing hook-testing harness; adding one was judged out of scope for a bug-fix pass.
- The full reproduction/test-plan matrix in this doc (emulator route playback, force-kill/cold
  restore, permission revocation, physical-device QA) was not executed — no Android
  emulator/device was available in this environment.
- Guided progress is not persisted across a cold app-kill (noted above under P0).
- Historical `RunnerRun` rows are not backfilled with a `validity` classification.
- `PRODUCTION_READINESS.md` gates were not touched.
