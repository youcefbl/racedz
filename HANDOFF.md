# Session handoff — Runs/Coach redesign, 2026-08-04

> Owner-requested handoff for the next session/device. Status, gates and priorities live only in
> `EXECUTION_PLAN.md` (see its four 2026-08-04 redesign rows); this file is the practical "pick it
> back up" sheet and should be deleted once the open items below are done.

## Where things stand

All on `feat/coach-tier0`:

| Commit | What |
|---|---|
| `ced709d` | Design pass: device captures (`docs/native-design/current/2026-08-04/`), 3 mockup variants + contact sheet (`docs/native-design/proposals/2026-08-04/index.html`), draft `docs/native-design/UI_RULES.md`, review NDP-R01–R09 remediated. |
| `afa20e7` | **Phase 1** — Runs overview Variant B: merged week card, stateful Record dock, `RunRecorder.start()` guard (+5 unit tests), shell restore-once fix, ar-DZ Western numerals, empty-state hero. **Device-verified** (`docs/native-design/current/2026-08-04-phase1/`). |
| `2528bf2` | **Phase 2** — Coach: header trial pill w/ days left (reserved slot), scope-labelled counters, orange-as-icon fix. *(Also carries the en/fr/ar strings for phases 3–4.)* |
| `f333b29` | **Phase 3** — Run detail: pace chart accent→primary (light AA), elevation→info, fastest-split accent bar, honest "route has no per-point timing" card. |
| `d1496f3` | **Phase 4** — Hold-to-start success pulse (300 ms single flash, frame-timed, reduced-motion safe), fastest-chip highlight on live splits. |

**Gates, all green at `7bcabb3`:** `assembleDebug`; `:feature:{runs,coach}:testDebugUnitTest`;
`:feature:{runs,coach}:lintDebug` + `:app:lintDebug`; `check:native-i18n` 514 keys en/fr/ar;
`test:coach-mobile` 165/165; `test:mobile-api` 111/111; `test:coach` (evals + 68/68 + 42/42);
`test:tts-claim` 13/13.

## Open items, in order

1. **USB re-authorization.** The Samsung SM-M215G is on the bus but `adb` reports `unauthorized`
   (it re-enumerated mid-session and dropped the grant; it did this through the Realtek hub
   before — drive adb behind `adb wait-for-device`). Unlock the phone and accept
   "Allow USB debugging" (replug the cable if no dialog appears).
2. **Device pass for phases 2–4** (phase 1 is already verified). Recipe in the
   `native-device-testing` memory and `docs/native-design/current/`'s naming convention:
   ```
   docker start racedz_postgres_dev && npm run dev        # 127.0.0.1:3003
   adb reverse tcp:3003 tcp:3003
   cd native-android && JAVA_HOME=$HOME/zidrun-toolchain/jdk17 ./gradlew assembleDebug \
     -Pzidrun.debugApiBase=http://localhost:3003/
   adb install -r -d app/build/outputs/apk/debug/app-debug.apk
   ```
   Seed `device.tester@zidrun.test` (script pattern in EXECUTION_PLAN's design-pass row; consent
   must use the exact `COACH_CONSENT_POLICY_VERSION`). Verify on device, three themes × en/ar ×
   1.3×: Coach trial pill + "whole plan" counter + muted Next-workout kicker; plan-week
   "this week" counter; run-detail chart hues + the empty-series card (a seeded route without
   `t`/`ele` shows it); hold-to-start completion pulse (and its absence with animator scale 0);
   fastest live-split chip during a recording. Attach captures to a new evidence row.
3. **French on-device pass** — still owed from phase 1 (renders exist; device pass doesn't).
4. **TalkBack / focus order / nav insets** — implementation-acceptance items for all phases,
   never claimed from screenshots (UI_RULES §10).
5. **Owner approval asks still formally open** (`docs/native-design/proposals/2026-08-04/`
   `RECOMMENDATION.md`): empty-state direction and Western-digits-for-Arabic are implemented and
   owner-seen but should be confirmed in `PRODUCT.md`; the Audiowide/Manrope question needs a
   `PRODUCT.md` decision (`UI_RULES.md` stays draft until then — see its header and AGENTS.md).

## Traps the next session should not rediscover

- The bottom tab bar **mirrors in RTL** — never tap fixed tab coordinates in Arabic.
- Screenshots race the load; dump `uiautomator` first or re-shoot after content text appears.
- `adb shell cmd locale set-app-locales dz.racedz.nativeapp.debug --locales ar` (not
  `--locale-tags`). Font scale: `settings put system font_scale 1.3` (reset to 1.0 after).
- Theme = `User.theme` in local Postgres + app restart; bare `ar` now normalizes to `ar-DZ`
  in `currentLocale()` — don't "fix" Arabic digits back.
- The save screen's Discard is a two-step button; uiautomator text match hits the in-prose
  "Discard" first — tap the **last** match.
- `RunRecorder.start()` now returns `Boolean` and refuses when non-idle — new callers must
  handle `false` (route to the live run), never force a reset.
