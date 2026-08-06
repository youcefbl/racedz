# Full native regression on the Galaxy M21 over Wi-Fi debugging

Executable regression script for the native Android app on the physical **Samsung SM-M215G**
(Galaxy M21, Android 13, 1080×2340 @ 420 dpi), driven over **wireless ADB**.

- **Connection recipe:** `docs/NATIVE_WIRELESS_DEBUGGING.md` — pairing, ports, `ANDROID_SERIAL`,
  and the traps. Do that first; this file assumes a connected device.
- **Status/evidence:** results go in `EXECUTION_PLAN.md` as a dated row, never here. This file is
  the procedure; the tracker is the record.
- **Why now:** everything in §3–§6 was changed after the last device pass and has been verified
  only by build, unit tests and lint. **None of it is device-verified.** It is owed for `PR-050`
  (signed physical-device acceptance), whose done-when includes Runs redesign parity across
  themes, locales and RTL.

> Run against the **local** stack only. Never point a device pass at production data.

---

## 1. Setup

```bash
export PATH=$HOME/zidrun-toolchain/android-sdk/platform-tools:$PATH
adb mdns services                      # rediscover: ports change every time
adb connect 192.168.100.28:<port>
export ANDROID_SERIAL=adb-RZ8T10W90CL-LonxX0._adb-tls-connect._tcp

docker start racedz_postgres_dev
npm run dev                            # 127.0.0.1:3003
adb reverse tcp:3003 tcp:3003

cd native-android
JAVA_HOME=$HOME/zidrun-toolchain/jdk17 ./gradlew assembleDebug \
  -Pzidrun.debugApiBase=http://localhost:3003/
adb install -r -d app/build/outputs/apk/debug/app-debug.apk
```

Record before starting: `adb shell getprop ro.product.model`,
`ro.build.version.release`, `wm size`, `wm density`, and the APK's version name/code.

**Seed data.** Sign in as `device.tester@zidrun.test`. The account needs: ~15 runs across several
weeks, one PR, an active coach goal, a generated plan week with a completed and a skipped session,
2–3 coach interactions, **one run with a timed + elevation-bearing route**, and **one run with an
untimed route** (both are needed by §5). Coach consent must use the exact
`COACH_CONSENT_POLICY_VERSION`.

**Capture convention.** `docs/native-design/current/<date>-regression/<case-id>-<variant>.png`.
Device screenshots may contain the seeded test account's data only — never owner personal data.

---

## 2. Matrix

Every case below runs in **light / dark / race** unless it is marked *(one theme)*.
Locale and font-scale passes are separate sweeps, not per-case:

| Sweep | How | Applies to |
|---|---|---|
| Themes | set `User.theme` in local Postgres, restart the app | all |
| Locales | `adb shell cmd locale set-app-locales dz.racedz.nativeapp.debug --locales en\|fr\|ar` | R-*, C-*, G-* |
| Font scale | `adb shell settings put system font_scale 1.3` (reset to `1.0`) | R-*, C-*, G-* |
| TalkBack | enable in Accessibility, then re-run A-* only | A-* |

---

## 3. Registration (never device-verified)

| ID | Case | Steps | Expected |
|---|---|---|---|
| `G-01` | Category carries through | Race detail → pick 5K → Register | Registration opens **on Details**, 5K already selected; the distance step is not shown again |
| `G-02` | Stale/foreign category ignored | Open `register/<race>?categoryId=<other race's id>` | Falls back to the distance chooser; no foreign category is selected |
| `G-03` | Progress indicator | Walk Details → Review → submit | "Step 1 of 3 / 2 of 3 / 3 of 3" visible; bar advances; TalkBack reads it as one phrase |
| `G-04` | Review before creation | Fill details → Continue | Review lists race, distance, **exact** price, runner, phone, emergency contact, and the organizer-sharing line. No entry exists yet (verify in DB) |
| `G-05` | Confirm creates once | Tap Confirm; tap again fast | Exactly one registration row; duplicate tap returns the same entry |
| `G-06` | Back from Review keeps the form | Review → system Back, then top-bar Back | Returns to **Details with every field intact**, not out of the flow |
| `G-07` | Back is terminal after payment | Reach Payment → Back | Does not re-enter the form |
| `G-08` | Process recreation | On Details with fields typed: `adb shell am kill dz.racedz.nativeapp.debug`, reopen | Typed fields and current step are restored |
| `G-09` | Date of birth, numeric keyboard | Clear DOB, type `19960521` **using only the on-screen numeric keypad** | Renders `1996-05-21`; Confirm becomes enabled. Repeat with fr and **Arabic** keyboards |
| `G-10` | Impossible date refused | Type `20260231` | Inline "not a real date" error; Confirm stays disabled |
| `G-11` | Required markers + reason | Clear emergency name | Field shows `*`; disabled Confirm states the emergency-contact reason |
| `G-12` | IME does not hide the field | Tab/Next from emergency name to phone | Focused field scrolls above the keyboard and stays visible |
| `G-13` | Payment with no destination | Register for a paid race whose organizer published no BaridiMob/CCP | "organizer has not published payment details" + held-entry line; **no method chips, no proof upload, no Bank transfer** |
| `G-14` | Payment with details | Race with BaridiMob and/or CCP | Only the backed methods appear; proof upload enabled |

---

## 4. Runs — dock, recorder, recovery (never device-verified)

| ID | Case | Steps | Expected |
|---|---|---|---|
| `R-01` | Dock reach | Runs tab, scroll to bottom | Record dock pinned above the tab bar at every scroll position; metric values not truncated |
| `R-02` | Dock while loading/offline | Enable airplane mode, open Runs | Dock still present and usable; loading/error state does not remove it |
| `R-03` | Recording state | Start a run → system Back to shell | Dock reads "Recording · X km — Open"; tapping returns to the live run |
| `R-04` | Paused state | Pause → back to shell | Dock reads "Paused · X km — Resume" |
| `R-05` | Pending save | Finish → back out of summary | Dock reads "Save run"; tapping reopens the summary |
| `R-06` | Process-death recovery | Record → `am force-stop` → relaunch | Summary surfaces **once**; after backing out the shell is reachable and the dock reads "Save run" |
| `R-07` | Second kill keeps it | Repeat force-stop + relaunch | Run still hydrated; never stranded |
| `R-08` | Discard resolves | Discard from summary | `run-as … ls files/run-outbox/` is empty; dock returns to Record |
| `R-09` | Corrupt outbox | `run-as … sh -c 'echo "{ x" > files/run-outbox/pending-run-<userId>.json'`, restart | Dock reads "A saved run can't be read — tap to clear it"; tapping quarantines to `.corrupt` and restores Record |
| `R-10` | Cross-account isolation | Record as A → sign out → sign in as B | B sees **no** pending run and can record immediately; A's run is intact when A returns |
| `R-11` | Hold-to-start latch | Hold the footprint control ~900 ms and **release the moment the haptic fires** | The run starts (this is the regression that used to cancel) |
| `R-12` | Hold abort | Hold ~400 ms and release | No run starts; ring winds back; no leftover glow |
| `R-13` | Reduced motion | `settings put global animator_duration_scale 0`, repeat `R-11` | Still starts; no aura pulse; ring jumps between states (reset the setting after) |

---

## 5. Runs — live, summary, detail (never device-verified)

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

## 6. Coach (never device-verified)

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
| `X-01` | Three themes | Every screen in §3–§6 renders correctly in light / dark / race |
| `X-02` | French | No truncation or clipped CTAs; "1 sortie", "série de N semaines", "1 séance sur 3" |
| `X-03` | Arabic RTL | Layout mirrors; **one numeral system per surface**; tab bar mirrored (do not use fixed tap coordinates) |
| `X-04` | 1.3× font | Nothing clipped; metric labels wrap rather than ellipsize; dock labels readable |
| `A-01` | TalkBack | Focus order sane; icon-only actions labelled; "Step N of 3" one phrase; GPS panel announces politely; hold control exposes an activate action |
| `A-02` | Insets | Gesture **and** three-button navigation: nothing under the bars on any screen |
| `P-01` | Cold start | `adb shell am start -W` ×3 — record, compare with the 3,456 ms debug baseline (debug build; a lead, not acceptance) |
| `P-02` | Jank | `gfxinfo` while scrolling Runs and Races — record; do not treat a debug build as release evidence |

---

## 8. Automated gates to run alongside

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

1. Discard any test run; confirm `run-as … ls files/run-outbox/` is empty.
2. Delete seeded test registrations created during §3.
3. `settings put system font_scale 1.0`; `settings put global animator_duration_scale 1`.
4. `cmd locale set-app-locales … --locales en`; reset `User.theme` to null.
5. Disable TalkBack.
6. Write the dated evidence row in `EXECUTION_PLAN.md`: device/OS/build, case IDs **passed**,
   case IDs **failed**, and case IDs **not run** — an unrun case is never a pass.

## 10. Reporting rules

- A case passes only if observed on the device. Source inspection and unit tests are not a pass.
- A failure gets its own tracker line with the reproduction, not just a mention in prose.
- Screenshots prove appearance at a moment; they do not prove gesture timing, focus order,
  process transitions, or storage behaviour — say so when that is all the evidence there is.
