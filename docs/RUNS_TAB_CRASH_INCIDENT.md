# Incident — Runs tab crash and runaway GPS recording

> Incident evidence and shipped remediation only. Current priority, progress, and release acceptance
> live exclusively in [`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md), gate `PR-050`.

**Reported:** 2026-07-26 · **Code hardened:** 2026-07-27 · **Emulator verified:** 2026-07-28 ·
**GPX evidence reviewed:** 2026-07-29 · **Severity:** P1/high
**Current assessment:** the strongest guided-state crash path is fixed and emulator regression tests
pass. The incident is not release-closed until signed physical-device acceptance closes `PR-050`.

## Summary

During a guided interval run, the runner pressed **Skip step** repeatedly and the Android Runs tab
fell into the account-level error boundary. Other tabs remained usable, but retry did not recover
Runs. The module-level GPS engine continued recording after the React view failed. Logout/login later
reset the JavaScript runtime, exposed the still-running session again, and allowed it to be saved after
it had captured vehicle travel and approximately 60 km.

The incident therefore combined two failures:

1. A guided-run UI state path could read a workout step outside the available array.
2. A React/UI failure did not own or stop the native GPS watcher, so recording continued invisibly.

The original exception was not captured. The guided-state defect is the best evidence-backed root
cause, not a claim of certainty about an unavailable stack trace.

## Timeline and evidence

| Evidence | Timestamp | What it establishes |
|---|---:|---|
| Runs account-error screenshot | 2026-07-26 20:56:47 | Runs had failed during the activity's starting minute. |
| Saved activity start | 2026-07-26 20:56 | The initial crash was not caused by a many-hour stale run. |
| Saved activity | 60.619 km; 3:17:58 elapsed; 1:46:28 moving | Native GPS continued after the UI failed and later captured motorized movement. |
| Saved-run screenshot | 2026-07-27 01:02:37 | A full auth/runtime reset made the session accessible and saveable again. |

The saved activity's moving speed was approximately **9.49 m/s (34.2 km/h)**, well outside normal
running movement. That explains the final invalid activity, but cannot explain the UI crash that
happened as recording began.

## Root-cause assessment

`use-workout-guidance.ts` kept shared module progress without a run/workout identity and read
`steps[stepIndex]!` without a runtime bound. Repeated skipping, a remount, or a changed workout could
leave the shared index invalid. A logout/login reset that module state, matching the observed recovery.

The fix keys shared guidance by a stable session key (run plus workout identity), clamps every current
step lookup, treats the next step as optional, and makes skip idempotent at the final step. This closes
the known starting-minute render failure even though the original device exception is unavailable.

## Shipped containment and hardening

- Recorder-scoped and route-level error handling keeps one component failure from replacing the whole
  account surface.
- Global `window.onerror` and `unhandledrejection` reporting sends privacy-safe status, point-count,
  elapsed/moving time, and guidance indexes—never route coordinates or health text.
- Active-run snapshots are versioned and user-scoped. Wrong-user and unowned legacy data cannot be
  restored into another account.
- Abort/discard/logout paths await native GPS, timer, and step-counter teardown. Persisted watcher IDs
  allow a fresh runtime to remove an orphan watcher before restoring a run paused.
- Cold restore corrects paused time and never silently deletes a legitimate long/ultra activity.
- Sustained implausible live speed pauses non-destructively instead of recording indefinitely.
- Saved GPS activities receive `VALID`, `SUSPECT`, or `EXCLUDED` validity. Non-valid activities cannot
  affect records, public/social surfaces, Coach metrics, adherence, or workout completion.
- Route buffers are bounded/downsampled and live map/recompute work is throttled to reduce WebView
  pressure on long sessions.
- GPX export provides visible preparing/success/failure feedback and a sanitized filename.

Relevant hardening landed across commits `78ce199`, `d79253d`, `ff26a10`, `67e06c9`, `08deea3`, and
`a83e159`.

## GPX forensic review

### Incident export — 2026-07-26

The supplied `zidrun-2026-07-26-c8694f.gpx` parses cleanly:

- 1,141 exported points;
- 60.66 km;
- 3:17:20 between first and last exported timestamp;
- monotonically increasing timestamps and no malformed opening segment;
- ordinary walking at the beginning;
- later vehicle-speed movement, with 685 exported segments above 8 m/s and gaps up to roughly 696
  seconds.

The file supports the server-side invalid-activity exclusion and long-route performance work. It does
not reveal a different opening crash cause. Export is downsampled and omits original Android `accuracy`
and `speed`, so it cannot reconstruct every live native fix or prove acquisition quality at the crash.

### Stationary-start export — 2026-07-28

The supplied `zidrun-2026-07-28-736998.gpx` confirms a separate distance defect. While the runner was
stationary, the first three displacements were approximately **20.34 m, 7.47 m, and 6.57 m** in 12.24
seconds: **34.38 m** of GPS acquisition wander. Every hop passed the former `accuracy <= 40 m` and
`distance <= 60 m` rules, so coordinate drift was summed as movement.

The recorder now:

- accepts reported accuracy up to 25 m;
- rejects segments when native reported speed is below 0.4 m/s;
- gives providers without speed a 15-second startup-settle window;
- replaces the unsaved starting fix while stationary; and
- preserves a post-settle displacement fallback for devices that never report speed.

Regression tests use only derived distances/times—not private coordinates. The raw GPX files remain
untracked because they contain precise location history.

## Verification evidence

- Focused incident tests cover guidance bounds, snapshot ownership/migration, cold timing, watcher
  lifecycle helpers, high-speed windows, GPS accuracy, stationary-speed rejection, and speedless
  startup fallback.
- The run-stat suite covers splits, pause gaps, pace, and elevation profiles.
- Browser coverage proves the Android picker has no restrictive `accept` MIME filter, invalid files
  receive a visible reason, and GPX export shows preparing/success/failure states.
- The server validity E2E scenario proves the incident's numbers are forced private and excluded from
  records, feed, leaderboards, kudos, and workout matching.
- Local lint, typecheck, full tests, and production build passed after hardening.
- Pixel 8 debug-emulator acceptance passed rapid guided skipping, force-kill/cold restore, and
  cross-account switching without a crash or route leak.
- Emulator sustained-speed auto-pause remained inconclusive because Android throttled rapid mock
  locations; the deterministic pure logic passed.

## Release disposition

Use [TESTING.md](TESTING.md) for the maintained signed-device matrix. `PR-050` remains open until the
exact signed release candidate passes physical-device voice/guidance, background GPS lifecycle,
stationary-start accuracy, genuine sustained non-foot movement, GPX selection from Drive/local storage,
Crashlytics evidence, and account-switch isolation. Record that evidence only in `EXECUTION_PLAN.md`.
