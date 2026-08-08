# Full native regression on the Galaxy M21 over Wi-Fi debugging

Repeatable automated + manual regression procedure for the native Android app on the physical
**Samsung SM-M215G** (Galaxy M21, Android 13, 1080×2340 @ 420 dpi), driven over
**wireless ADB**.

- **Connection recipe:** `docs/NATIVE_WIRELESS_DEBUGGING.md` — pairing, ports, `ANDROID_SERIAL`,
  and the traps. Do that first; this file assumes a connected device.
- **Status/evidence:** results go in `EXECUTION_PLAN.md` as a dated row, never here. This file is
  the procedure; the tracker is the record.
- **Scope:** this procedure supplies physical-device evidence for `PR-050`. Current completion,
  blockers and release-gate status belong only in `EXECUTION_PLAN.md`; do not encode mutable
  progress claims in this runbook.
- **Build rule:** a debug build is suitable for finding functional, UI and performance leads.
  Signed-device acceptance must be repeated on the exact signed release candidate.

> Run against an approved **isolated non-production** stack only. Never point this regression at
> production data.

---

## 1. Setup

### Debug discovery pass

```bash
export PATH=$HOME/zidrun-toolchain/android-sdk/platform-tools:$PATH
export PKG=dz.racedz.nativeapp.debug
export ACTIVITY=dz.racedz.nativeapp.MainActivity

# Rediscover every session: both the address and port may have changed.
adb mdns services
adb connect <host>:<connect-port>
adb devices -l

# Copy one exact serial from `adb devices -l`; do not reuse the example from an old session.
export ANDROID_SERIAL=<connected-device-serial>
adb get-state

docker start racedz_postgres_dev
npm run dev                            # 127.0.0.1:3003
adb reverse tcp:3003 tcp:3003

cd native-android
JAVA_HOME=$HOME/zidrun-toolchain/jdk17 ./gradlew assembleDebug \
  -Pzidrun.debugApiBase=http://localhost:3003/
adb install -r -d app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n "$PKG/$ACTIVITY"
```

### Signed-candidate acceptance pass

Do not rebuild or substitute the artifact chosen for acceptance. Install the owner-approved signed
APK, set `PKG` to its actual application ID, and record its digest before testing:

```bash
sha256sum <signed-candidate.apk>
adb install -r <signed-candidate.apk>
export PKG=<candidate-application-id>
adb shell am start -n "$PKG/$ACTIVITY"
```

The signed candidate must be configured for an approved **non-production** backend with isolated
test data. The current debug/local command above is not signed-candidate evidence, and a
production-wired artifact must not be used for this procedure. If no signed non-production
candidate exists, `PR-050` remains blocked; do not treat the debug pass as a substitute.

Record the immutable test context before starting:

```bash
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell wm size
adb shell wm density
adb shell dumpsys package "$PKG" | rg 'versionName|versionCode'
git rev-parse HEAD
```

**Fixture gate.** Sign in as the local-only `device.tester@zidrun.test` account and export its local
database UUID as `TEST_USER_ID`. Before counting any result, confirm that the account has: ~15 runs
across several weeks, one PR, an active coach goal, a generated plan week with a completed and a
skipped session, 2–3 coach interactions, **one run with a timed + elevation-bearing route**, and
**one run with an untimed route**. Coach consent must use the exact
`COACH_CONSENT_POLICY_VERSION` from source.

There is currently no checked-in command that deterministically creates or resets this complete
fixture. If the account, password or any required state is missing, mark the affected cases
**not run / fixture blocked**. Do not improvise with an owner's account or claim a reproducible pass.
The eventual fixture command and its version belong in the dated `EXECUTION_PLAN.md` evidence row.

**Capture convention.** `docs/native-design/current/<date>-regression/<case-id>-<variant>.png`.
Device screenshots may contain the seeded test account's data only — never owner personal data.

---

## 2. Matrix

Run every functional transition in §3–§6 once in **English, light theme, 1.0× font**. Then run the
separate visual/localization/accessibility sweeps below against the representative stable states
listed in §7. Do not multiply destructive or timing cases across every theme unless a change
specifically affects them.

| Sweep | How | Applies to |
|---|---|---|
| Baseline | English, light, 1.0× font | every functional case in §3–§6 |
| Themes | set `User.theme` in local Postgres, restart the app | `X-01` stable-state list |
| Locales | `adb shell cmd locale set-app-locales "$PKG" --locales en\|fr\|ar` | `X-02`, `X-03` and locale-specific cases |
| Font scale | `adb shell settings put system font_scale 1.3` (reset to `1.0`) | `X-04` stable-state list |
| TalkBack | enable in Accessibility, then re-run A-* only | A-* |

---

## 3. Registration

| ID | Case | Steps | Expected |
|---|---|---|---|
| `G-01` | Category carries through | Race detail → pick 5K → Register | Registration opens **on Details**, 5K already selected; the distance step is not shown again |
| `G-02` | Stale/foreign category ignored | Open `register/<race>?categoryId=<other race's id>` | Falls back to the distance chooser; no foreign category is selected |
| `G-03` | Progress indicator | Walk Details → Review → submit | "Step 1 of 3 / 2 of 3 / 3 of 3" visible; bar advances; TalkBack reads it as one phrase |
| `G-04` | Review before creation | Fill details → Continue | Review lists race, distance, **exact** price, runner, phone, emergency contact, and the organizer-sharing line. No entry exists yet (verify in DB) |
| `G-05` | Confirm creates once | Record the test user's DB count; tap Confirm twice rapidly; check the count and returned registration ID | First tap disables or otherwise latches the action while in flight; exactly one row is added and one registration is shown. The automated mobile-API gate remains authoritative for same-key replay and simultaneous-request races |
| `G-06` | Back from Review keeps the form | Review → system Back, then top-bar Back | Returns to **Details with every field intact**, not out of the flow |
| `G-07` | Back is terminal after payment | Reach Payment → Back | Does not re-enter the form |
| `G-08` | Background process death | On Details with fields typed: note `adb shell pidof "$PKG"`; press Home; run `adb shell am kill "$PKG"`; confirm the old PID is gone; relaunch with `adb shell am start -n "$PKG/$ACTIVITY"` | Typed fields and current step are restored. If the PID did not die, the precondition failed and this case is **not run**, not passed. Do not substitute `force-stop`: it changes task/package state and does not test the same lifecycle path |
| `G-09` | Date of birth, numeric keyboard | Clear DOB, type `19960521` **using only the on-screen numeric keypad** | Renders `1996-05-21`; Confirm becomes enabled. Repeat with fr and **Arabic** keyboards |
| `G-10` | Impossible date refused | Type `20260231` | Inline "not a real date" error; Confirm stays disabled |
| `G-11` | Required markers + reason | Clear emergency name | Field label ends `· Required` (the implementation's marker, chosen over `*` because a screen reader reads it); disabled Confirm states the emergency-contact reason, and the reason updates as each requirement is met |
| `G-12` | IME does not hide the field | Tab/Next from emergency name to phone | Focused field scrolls above the keyboard and stays visible |
| `G-13` | Payment with no destination | Register for a paid race whose organizer published no BaridiMob/CCP | "organizer has not published payment details" + held-entry line; **no method chips, no proof upload, no Bank transfer** |
| `G-14` | Payment with details | Race with BaridiMob and/or CCP | Only the backed methods appear; proof upload enabled |

---

## 4. Runs — dock, recorder, recovery

| ID | Case | Steps | Expected |
|---|---|---|---|
| `R-01` | Dock reach | Runs tab, scroll to bottom | Record dock pinned above the tab bar at every scroll position; metric values not truncated |
| `R-02` | Dock while loading/offline | **Over USB:** enable airplane mode, open Runs. **Over wireless ADB:** airplane mode severs the only link to the device and needs the owner to re-enable Wireless debugging by hand — use `adb reverse --remove tcp:3003` instead and say so in the result, because that proves the dock survives the error state without exercising airplane mode | Dock still present and usable; loading/error state does not remove it |
| `R-03` | Recording state | Start a run → system Back to shell | Dock reads "Recording · X km — Open"; tapping returns to the live run |
| `R-04` | Paused state | Pause → back to shell | Dock reads "Paused · X km — Resume" |
| `R-05` | Pending save | Finish → back out of summary | Dock reads "Save run"; tapping reopens the summary |
| `R-06` | Durable recovery after force-stop | Record → `adb shell am force-stop "$PKG"` → `adb shell am start -n "$PKG/$ACTIVITY"` | Summary surfaces **once**; after backing out the shell is reachable and the dock reads "Save run" |
| `R-07` | Second force-stop keeps it | Repeat the exact `R-06` stop/start commands | Run still hydrated; never stranded |
| `R-08` | Discard resolves | Discard from summary; on the debug build only, run `adb shell "run-as $PKG ls -la files/run-outbox/"` | Dock returns to Record; debug white-box evidence also shows no pending JSON remains for the test user |
| `R-09` | Corrupt outbox *(debug-only fault injection)* | With `TEST_USER_ID` set, run `adb shell "run-as $PKG sh -c 'mkdir -p files/run-outbox && printf \"{ x\" > files/run-outbox/pending-run-$TEST_USER_ID.json'"`, then restart | Dock reads "A saved run can't be read — tap to clear it"; tapping quarantines to `.corrupt` and restores Record. Do not attempt `run-as` on a non-debuggable signed candidate |
| `R-10` | Cross-account isolation | Record as A → sign out → sign in as B | B sees **no** pending run and can record immediately; A's run is intact when A returns |
| `R-11` | Hold-to-start latch | Hold the footprint control ~900 ms and **release the moment the haptic fires** | The run starts (this is the regression that used to cancel) |
| `R-12` | Hold abort | Hold ~400 ms and release | No run starts; ring winds back; no leftover glow |
| `R-13` | Reduced motion | `settings put global animator_duration_scale 0`, repeat `R-11` | Still starts; no aura pulse; ring jumps between states (reset the setting after) |

---

## 5. Runs — live, summary, detail

| ID | Case | Steps | Expected |
|---|---|---|---|
| `L-01` | Acquiring state | Start a run indoors | Compact panel: "Searching…" + "time is counting; distance starts once the signal is good". **No** large empty map |
| `L-02` | GPS-ready state | Wait for a usable fix while stationary | Panel switches to "GPS ready — start moving…". It must **never** show "Searching" beside a "Recording · Strong GPS" pill |
| `L-03` | Map appears | Move until ≥2 route points | Trusted-route map replaces the panel |
| `L-04` | Live splits | Complete ≥2 km | Fastest completed km highlighted; TalkBack appends "fastest" |
| `L-05` | Auto-pause | Sustained vehicle speed (or simulate) | Pill + banner say auto-paused; moving time freezes |
| `L-06` | Zero-distance summary | Finish a run with no fix | **No** reserved map; "No route was captured"; Save disabled, Discard reachable without scrolling |
| `L-07` | Finish dialog copy | Finish any run | Says title and **notes** next — never photos |
| `L-08` | Detail charts | Open the timed seeded run | Splits, Elevation and Pace all render; pace line is green in light (not orange) |
| `L-09` | Per-metric absence | Open the untimed seeded run | Separate reasons for splits, pace and elevation — untimed vs too-short vs no-elevation, whichever is true |
| `L-10` | Shipped controls intact | Scroll run detail to the end | Analyze run, Export GPX, Visibility toggle, Delete all present |
| `L-11` | System bars on dark routes | App in **Light**, open pre-run and live screens | Clock/battery/signal icons are **light on the dark surface**; pre-run Back arrow clearly visible |

---

## 6. Coach

| ID | Case | Steps | Expected |
|---|---|---|---|
| `C-01` | Trial pill | Trial account, open Coach | Pill sits beside the title from first paint (no pop-in shift); reads "Free trial · N days left" with N = ceiling |
| `C-02` | Last day | Trial ending in <24 h | Reads "last day", not a vanished count |
| `C-03` | Scope labels | Coach overview then Plan | "Whole plan" ring vs "N of M sessions this week" — no contradiction |
| `C-04` | Next ≠ today | Plan with a session scheduled earlier today | "Next workout" is a **later day**, never today's session |
| `C-05` | Guided handoff | Coach → "Log this run" | Start screen opens with **Guided** selected and the workout's steps visible; Free still selectable |
| `C-06` | Ring numerals (ar) | Arabic locale | Ring shows Western digits on both lines ("3" over "من 6") |
| `C-07` | Bidi isolation | Arabic app locale, English coach goal | `6 × 800 m at 5K effort …` reads **in its original order**; no reordering to "…800 × 6" |
| `C-08` | Date isolation (ar) | Arabic, Runs latest-run card | Date reads `3 أوت 2026، 17:30`, not `17:30 ,2026 أوت 3` |

---

## 7. Cross-cutting sweeps

| ID | Case | Expected |
|---|---|---|
| `X-01` | Three themes | The stable-state list below renders correctly in light / dark / race; no light-theme orange body text, lost contrast or theme fallback |
| `X-02` | French | Stable-state list plus single-count states: no truncation or clipped CTAs; "1 sortie", "série de N semaines", "1 séance sur 3" |
| `X-03` | Arabic RTL | Stable-state list: layout and tab order mirror; **one numeral system per surface**; use hierarchy dumps rather than fixed tap coordinates |
| `X-04` | 1.3× font | Stable-state list: no clipped content or unreachable action; metric labels wrap rather than ellipsize; dock labels remain readable |
| `A-01` | TalkBack, manual | On Registration, Runs/live run and Coach: focus order is sane; icon-only actions are labelled; "Step N of 3" is one phrase; GPS updates do not chatter; hold control exposes an activate action. A hierarchy dump cannot prove spoken output |
| `A-02` | Insets, manual | On Registration, Runs/live run and Coach, repeat with gesture and three-button navigation; no control or content sits under system bars |
| `P-01` | Cold-start diagnostic | Follow the fixed procedure below and record all five `TotalTime` values, median and range. Compare only runs using the same build type, device state and method |
| `P-02` | Scroll-frame diagnostic | Follow the fixed `gfxinfo` procedure below; record total/janky frames and frame-time percentiles. Any frozen frame (>700 ms) or material regression from a same-method baseline requires investigation |

**Stable-state sweep list:** Registration Details, Review and Payment; Runs overview when idle,
recording and pending-save; pre-run, live acquiring, live mapped, summary and run detail; Coach
overview, plan week and guided-run handoff. Capture the top and bottom of scrollable screens. A state
that cannot be reached because its fixture is missing is recorded as **not run**, never silently
omitted.

### P-01 — reproducible cold-start diagnostic

Use a settled device, keep it awake and disconnected from charging if practical, record battery
level/temperature, and close unrelated foreground apps. Run one unrecorded warm-up, then five
measured starts. `-S` force-stops the package before each launch.

```bash
adb shell am start -S -W -n "$PKG/$ACTIVITY" >/dev/null
for sample in 1 2 3 4 5; do
  adb shell am start -S -W -n "$PKG/$ACTIVITY"
done
```

Record `TotalTime` for every sample plus median and range. Do not compare this debug result with an
old number unless package, build type, device, fixture, compilation state and command are the same.
Do not use it as signed-release acceptance. Android's startup guidance explains the distinction
between time to initial display and time to full display:
<https://developer.android.com/topic/performance/vitals/launch-time>.

### P-02 — reproducible scroll-frame diagnostic

Start each capture from the same seeded state and scroll each surface **top → bottom → top** at a
consistent pace: Runs overview, Races list, run detail with charts, and Coach overview. Reset the
collector immediately before each surface and save the raw output instead of relying on visual
memory.

```bash
adb shell dumpsys gfxinfo "$PKG" reset
# Manually perform the named top → bottom → top gesture sequence on one surface.
adb shell dumpsys gfxinfo "$PKG" framestats > <evidence-dir>/<surface>-framestats.txt
```

Record total frames, janky frames, 50th/90th/95th/99th-percentile frame times, and any frozen frames.
Use the same build, fixture, animation scale and device conditions for comparisons. A debug capture
is a regression lead only; repeat material findings on the signed candidate. See Android's rendering
vitals definitions: <https://developer.android.com/topic/performance/vitals/render>.

---

## 8. Execution cadence and companion automated gates

- After a meaningful native change, run `npm run test:native-device`, the affected manual functional
  cases, and the relevant stable states in light/dark/race, French, Arabic RTL and 1.3× font.
- Before `PR-050` closes, run the complete baseline, all cross-cutting sweeps, `P-01` and `P-02` on
  the exact signed candidate.
- The device command below clears only the local debug and benchmark packages, starts/reuses the
  local stack, installs through Gradle, runs black-box UI smoke tests, and collects Macrobenchmark
  startup/frame results from the physical phone. It currently automates category handoff + Arabic
  DOB entry, Runs/Coach reachability, dock persistence while scrolling, cold startup, and Runs,
  Coach and Registration scrolling. It does **not** automate the full matrix, TalkBack, permissions,
  recorder lifecycle/recovery, themes/locales, Races/run-detail scrolling, or signed acceptance.

```bash
export ANDROID_SERIAL=<connected-device-serial>
npm run test:native-device
```

Reports are written under `native-android/app/build/reports/androidTests/connected/`; benchmark JSON
and Perfetto traces are under
`native-android/macrobenchmark/build/outputs/connected_android_test_additional_output/`.

Run the existing source/API gates below alongside a device session. They do **not** replace the
manual or signed-device acceptance above.

```bash
cd native-android && JAVA_HOME=$HOME/zidrun-toolchain/jdk17 ./gradlew \
  assembleDebug :feature:runs:testDebugUnitTest :feature:coach:testDebugUnitTest \
  :feature:runs:lintDebug :feature:coach:lintDebug :feature:registration:lintDebug \
  :core:design:lintDebug :app:lintDebug
cd .. && npm run check:native-i18n && npm run test:registration && \
  npm run test:mobile-api && npm run test:coach-mobile && npm run test:coach && npm run test:tts-claim
```

---

## 9. Teardown

1. Discard any test run; confirm
   `adb shell "run-as $PKG ls -la files/run-outbox/"` has no pending JSON for the test user.
2. Delete seeded test registrations created during §3.
3. Run `adb shell settings put system font_scale 1.0` and
   `adb shell settings put global animator_duration_scale 1`.
4. Run `adb shell cmd locale set-app-locales "$PKG" --locales en`; reset the test user's
   `User.theme` to its pre-run value.
5. Disable TalkBack.
6. Write the dated evidence row in `EXECUTION_PLAN.md`: device/OS/build, case IDs **passed**,
   case IDs **failed**, and case IDs **not run**, plus raw `P-01`/`P-02` evidence paths — an unrun
   case is never a pass.

## 10. Reporting rules

- A case passes only if observed on the device. Source inspection and unit tests are not a pass.
- A failure gets its own tracker line with the reproduction, not just a mention in prose.
- Screenshots prove appearance at a moment; they do not prove gesture timing, focus order,
  process transitions, or storage behaviour — say so when that is all the evidence there is.
- Every result names the commit, APK version code/name, build type, device/OS, fixture identity,
  locale, theme, font scale and navigation mode. Performance results also record battery/thermal
  state and raw output paths.
- Never reuse an old screenshot or timing as evidence for a new APK. It may be a comparison only.
