# ZidRun Testing Guide

This file explains **how** to verify ZidRun. Release priority and completion status live only in
[`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md).

## Automated quality gate

Use the canonical local origin `http://127.0.0.1:3003`. Do not point tests at development or
production data.

```bash
npm run lint
npm run typecheck
npm run test:all
npm run build
npm run smoke
```

Useful focused commands:

```bash
npm run test:coach
npm run test:workout
npm run test:audio
npm run test:run-incident
npm run test:run-stats
npm run test:mfa
npm run test:registration
npm run test:e2e
npm run test:e2e:visual
```

The browser runner derives a database ending in `_e2e` by default, resets it, applies migrations,
and seeds deterministic fixtures. The reset script refuses any database name that does not end in
`_e2e` or `_ci`. Visual snapshots may be updated only after inspecting the changed images.

## Release browser matrix

Run these journeys against the exact release candidate:

1. **Authentication:** register, receive verification email, verify, login, MFA where applicable,
   password reset, blocked-user behavior, safe callback redirects, and logout.
2. **Runner:** discover/filter a race, register once, prevent duplicates/over-capacity, upload payment
   proof, view/cancel where allowed, and receive the expected notification.
3. **Organizer:** request organization access, admin approval, invite/accept a member, create/edit a
   multi-category race, publish for review, manage registrations, announce, and export CSV.
4. **Admin:** approve/reject organizations and races, edit/unpublish/republish, manage users, verify
   audit history, support, reports, and error diagnostics.
5. **Coach:** onboarding, plan generation/acceptance, workout actions, text response, transcription,
   safety refusal, entitlements, memory controls, manual/GPS/GPX run handling, and offline retry.
6. **Cross-cutting:** light/dark/race themes, EN/FR/AR, RTL, keyboard/focus, 44 px touch targets,
   loading/error/empty states, narrow mobile viewport, and supported desktop browser.

## Android setup

The detailed build/setup commands are in [MOBILE_ANDROID.md](MOBILE_ANDROID.md). For a USB phone:

```bash
adb devices
adb reverse tcp:3003 tcp:3003
CAP_SERVER_URL=http://localhost:3003 npm run cap:sync
npm run android:run
```

Use a signed release build for final acceptance. Record app version/version code, commit, phone model,
Android version, date, and whether battery optimization was enabled.

## Android release matrix

### Shell, auth, and navigation

- Cold start, splash, safe areas, bottom navigation, Android back, external/deep links, and app links.
- Credentials and Google handoff, verification, MFA policy, logout, and account switching.
- Force-stop/relaunch from each critical screen; no stale cross-account state.

### GPS and run lifecycle

- Start while stationary outdoors for 45 seconds: distance should remain approximately 0–5 m and
  pace should stay blank until genuine movement.
- Walk/run a measured 100–200 m, stop 30 seconds, resume, pause/resume manually, lock the screen,
  background/foreground, lose/restore GPS permission, and finish/save once.
- Force-stop during a run: restore it paused with accurate elapsed/moving time and no orphan watcher.
- Try rapid guided-step skipping and repeated Runs/Coach/Races navigation.
- Verify warm-up, work steps, cool-down, test voice, Full/Essential/Tones profiles, Bluetooth/headset,
  volume changes, screen-off guidance, and interruption recovery.
- Exercise a genuine sustained bike/car-speed track and confirm non-foot auto-pause without deleting
  the activity.

### GPX import/export

- Select a valid `.gpx` from Google Drive and local Downloads.
- Verify wrong extension, malformed XML, file over 5 MB, offline failure, and server rejection all
  show a visible reason.
- Import a known fixture and compare start time, duration, distance, splits, route, and elevation.
- Export a GPS run and verify progress feedback, filename, valid XML, route contents, and failure copy.

### Native services

- Production FCM token registration, foreground/background delivery, tap routing, preference opt-out,
  and test-push diagnostics.
- A deliberate non-sensitive Crashlytics test event appears with the correct release/build.
- Hosted App Links verify against the Play App Signing certificate and open without a chooser.

## Performance and resilience

- Test at least one representative low/mid-range Android device, a long run list, a long route, and a
  throttled network.
- Watch for input delay, WebView reloads, growing memory, map animation jank, duplicate requests, and
  battery/background-service termination.
- Useful native diagnostics:

```bash
adb logcat -c
adb logcat | rg -i "chromium|capacitor|AndroidRuntime|error|fatal|exception"
adb shell dumpsys meminfo dz.racedz.app
```

Never paste route coordinates, health text, tokens, passwords, or payment evidence into bug reports.

## Evidence format

For a failed test, capture:

- exact commit and build/version code;
- environment, device/browser, OS, locale, and theme;
- numbered reproduction steps and expected/actual behavior;
- sanitized screenshot/video and safe logs;
- whether it reproduces after restart and on another device.

For a passed release gate, add one concise dated evidence row to `EXECUTION_PLAN.md`. Do not create a
new progress document.
