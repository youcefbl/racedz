# M21 full native regression — 2026-08-06/07

Procedure: `docs/NATIVE_REGRESSION_M21.md`. This file is the working record for the session; the
dated evidence row belongs in `EXECUTION_PLAN.md`.

## Test context

| Field | Value |
|---|---|
| Device | Samsung SM-M215G (Galaxy M21) |
| OS | Android 13, SDK 33 |
| Panel | 1080×2340 @ 420 dpi |
| Transport | wireless ADB (`adb reverse tcp:3003`) |
| Build type | **debug**, `dz.racedz.nativeapp.debug` |
| APK | versionName `0.8.0-debug`, versionCode `8` |
| Commit at session start | `0f7f4e3` **plus uncommitted working-tree changes** |
| Backend | local `npm run dev` on 127.0.0.1:3003, `racedz_postgres_dev` |
| Fixture | `device.tester@zidrun.test`, `TEST_USER_ID=cmseeztlg000012uutg9ytgmi` |
| Locale / theme / font | en / light / 1.0× unless a case says otherwise |
| Navigation mode | three-button (device default) |
| Battery / thermal at start | 96 %, 30.5 °C, not charging |

**Build note.** The working tree as handed over did not compile: `ZidRunApp.kt` used
`testTagsAsResourceId` without an opt-in. Added `@OptIn(ExperimentalComposeUiApi::class)` to get a
build; no behavioural change.

**Fixture gate — met.** 15 runs 2026-06-23 → 2026-08-03, active goal, one plan with 6 workouts
including a COMPLETED and a SKIPPED, 3 coach interactions, consent `coach-consent-2026-08-v1`
GRANTED (matches `COACH_CONSENT_POLICY_VERSION` in `src/lib/coach/consent.ts`), one run with a
timed + elevation-bearing route (2026-08-03, points carry `t` and `ele`), 13 runs with untimed
routes. Payment destinations were absent on every seeded race, so BaridiMob/CCP were seeded onto
`tizi-ouzou-trail-challenge` to make `G-14` reachable; reverted in teardown.

## Defects found and fixed this session

### D-01 — date of birth could not be typed on the numeric keypad *(fixes `G-09`)*

Tapping `1 9 9 6 0 5 2 1` on the on-screen keypad produced **`1996-52-10`**, and backspace could not
clear the field. `ZidRunTextField` used the `String` overload of `OutlinedTextField`, so when the
view model re-inserted the dashes the caret kept its old *character* offset — every separator the
formatter added pushed the caret backwards through the text. Per-tap trace:

```
after 1: '110'      after 6: '1996-10'
after 9: '1910'     after 0: '1996-01-0'
after 9: '1991-0'   after 5: '1996-50-10'
                    after 2: '1996-52-01'
                    after 1: '1996-52-10'
```

Fix: `core/design/…/Components.kt` — the field now owns a `TextFieldValue` and re-anchors the caret
to the same content character when the caller reformats. Re-tested: renders `1996-05-21`, backspace
clears the field. This is a design-system fix, so it covers every reformatting field, not just DOB.

### D-02 — a race deep link was silently swallowed after process death

`zidrun://race/<slug>` (and the `https://zidrun.com/races/…` filter) did nothing whenever Android had
restored the app from process death. `splashResolved` was a one-shot flag set by `SplashRoute`, but a
restore rebuilds the saved back stack without ever composing the splash, so the flag stayed `false`
for the rest of that process and every incoming race link was parked and never opened.

Reproduction (deterministic, both before and after):

```
force-stop → am start → deep link   → opens the race        (worked before)
home → am kill → am start → deep link → stayed on old screen (broken before)
```

Fix: `ZidRunApp.kt` — read "the splash has handed over" from `currentBackStackEntryAsState()` rather
than from a flag. Both paths now open the race.

### D-03 — focused field stayed clipped under the keyboard *(fixes `G-12`)*

On Registration, Next-ing from emergency-contact name to phone left the focused field flush against
the IME with its bottom border and supporting line hidden. Cause: `.verticalScroll()` was applied
**before** `.imePadding()`, so the insets padded the scrolled *content* while the scroll viewport
still ran the full window height — the scroller counted a field under the keyboard as already
visible and refused to scroll to it.

Fix: insets before the scroller in `RegistrationScreen`, `AuthScreen` and `SettingsScreens` (all
three shared the order). `ZidRunTextField` also now asks `bringIntoView` for a strip taller than the
field so the supporting line clears the keyboard too.

### D-04 — race detail kept offering "Register" for a race just entered

Backing out of a completed registration returned to a stale race detail still showing the `Register`
call to action and the pre-registration places count; a second tap would start another entry. The
screen only loaded in `init`. Fix: `RaceDetailScreen` refetches on `ON_RESUME` via a new
`RaceDetailViewModel.reload()` that keeps the current content instead of flashing the page spinner
or replacing a good screen with an error.

Also renamed the misleading `onRegister: (raceId, raceTitle)` parameter — it has always carried the
category id.

### D-05 — black-on-black system bars the moment a run started *(fixes `L-11`)*

In **Light**, the pre-run screen drew white clock/battery/signal icons on its dark surface correctly,
but starting a run turned them black-on-black — unreadable, outdoors, mid-run. `ZidRunDarkSurfaceSystemBars`
pinned the bars on enter and restored the theme's choice in `onDispose`; navigating from one dark
screen straight to the next composes the incoming screen *before* disposing the outgoing one, so the
outgoing screen's restore ran last and undid the incoming screen's pin.

Fix: `Theme.kt` counts how many dark-surface screens are composed and only restores when the last one
leaves. Verified on device: bars stay light through pre-run → live.

### D-06 — two numeral systems on one Arabic surface *(fixes `X-03`)*

In Arabic the coach card read `⁦9,0 km⁩ · ٥٥ د` — Western digits for the distance, Arabic-Indic for the
duration. `runs_step_minutes` / `runs_step_metres` used a `%1$d` placeholder, which Android formats
with the *resource* locale (bare `ar` → Arabic-Indic), bypassing the `ar-DZ` normalisation every other
number goes through. `ZidRunFormat.count` exists for exactly this and documents the trap; these two
strings predated it.

Fix: both strings take `%1$s`, and all six call sites (coach overview, plan week, pre-run guided steps,
spoken run cues) pass `ZidRunFormat.count(value, locale)`. Added `localeOf(context)` for the cue
builder, which formats outside a composition. Now reads `⁦9,0 km⁩ · 55 د`.

### D-07 — "Today's workout" showed a session scheduled for another day *(fixes `C-04`)*

On a day with no session, the coach overview labelled **tomorrow's** long run "Today's workout" while
the card beside it correctly dated the same session `08 AUG 2026`. `getTodayGuidedWorkout` filtered on
`scheduledFor >= date_trunc('day', NOW())` with no upper bound, so it returned the next PLANNED session
on any future day. The `nextWorkout` query above it carries a comment about being fixed for the mirror
image of this bug (DEV-R05); the *today* side was never given its upper bound. The web's
`coach-overview.tsx` has always meant strictly today.

Fix: `src/lib/coach/service.ts` adds `< date_trunc('day', NOW()) + INTERVAL '1 day'`. Verified both
ways on device — with no session today the card disappears and only "Next workout" shows; with a
session seeded at 06:00 today, "Today's workout" is that session and "Next workout" is 08 AUG.

## Improvement applied

**Guided session preview no longer stops silently at four steps.** `GuidedPlanCard` rendered
`steps.take(4)` with nothing to say the list continued, so a 15-step interval session read as
"Warm up · Work · Recover · Work" and stopped — the card's stated job is to tell the runner what they
are committing to. It now appends a localised "+N more steps" (en/fr/ar, correct Arabic plural forms).

## §3 Registration

| ID | Result | Evidence / note |
|---|---|---|
| `G-01` | **pass** | 21.1K picked on detail → registration opened on Step 1 Details, no distance step; Review confirmed "21K Half Marathon" |
| `G-02` | **pass** | Carried category made foreign in the DB while the race still offered two others → fell back to "Choose your distance" listing only the race's own distances |
| `G-03` | **pass** | "Step 1 of 3 / 2 of 3 / 3 of 3", 3-segment bar advances; exposed to accessibility as one phrase (`D='Step 2 of 3'` on the container) |
| `G-04` | **pass** | Race, distance, exact price (2,800 DZD = DB `priceDzd`), runner, phone, emergency contact, organizer-sharing line; DB count unchanged at 2 |
| `G-05` | **pass** | Two taps in one shell round-trip → count 2 → 3, exactly one row, one registration shown |
| `G-06` | **pass** | System Back *and* top-bar Back from Review both return to Details with DOB, emergency name and phone intact |
| `G-07` | **pass** | Back from Payment exits to race detail, does not re-enter the form |
| `G-08` | **pass** | PID 22973 confirmed gone after `am kill`, relaunched as 24077; typed field and step restored |
| `G-09` | **fail → fixed → pass** | See **D-01** |
| `G-10` | **pass** | `20260231` → "That is not a real date. Check the day and month."; Continue inert, disabled reason names the date |
| `G-11` | **pass** *(deviation)* | Required fields are marked "· Required" rather than `*`, and the disabled reason updates live ("Add an emergency contact name and phone — required for race day." → "Accept the race rules to continue."). Better for TalkBack than the asterisk the runbook specifies; runbook wording should follow the implementation |
| `G-12` | **fail → fixed → pass** | See **D-03** |
| `G-13` | **pass** | No published destination → "The organizer has not published payment details for this race yet." + held-entry line; no method chips, no proof upload, no bank transfer |
| `G-14` | **pass** | With BaridiMob + CCP seeded: only those two chips, destination details, payment note, proof upload enabled |

## §4 Runs — dock, recorder, recovery

| ID | Result | Evidence / note |
|---|---|---|
| `R-01` | **pass** | Dock pinned at `[0,1797][1080,2039]`, above the tab bar at every scroll position; 117.60 km / 14.20 km / 4:58/km all render in full |
| `R-02` | **pass** *(method deviation)* | Airplane mode is **not usable over wireless ADB** — enabling it cut the only link to the device and cost a reconnect. Ran instead with the API made unreachable (`adb reverse --remove tcp:3003`): "You are offline / Check your connection and try again. / Try again" and the dock still present and usable. The dock's survival of the error state is proven; airplane mode itself was not exercised |
| `R-03` | **pass** | "Recording · 0.00 km — Open"; tapping reopened the live run |
| `R-04` | **pass** | "Paused · 0.00 km — Resume" |
| `R-05` | **pass** | Back from summary → shell, dock "Save run"; tapping reopened the summary |
| `R-06` | **pass** | Summary surfaced once after `force-stop`; shell reachable; dock "Save run"; did not re-surface across tab navigation |
| `R-07` | **pass** | Second identical stop/start — run still hydrated, dock "Save run", outbox JSON intact |
| `R-08` | **pass** | Two-step discard ("Tap again to discard"); dock back to "Record run"; `run-as ls files/run-outbox/` empty |
| `R-09` | **pass** | Corrupt JSON → "A saved run can't be read — tap to clear it"; tap quarantined it to `pending-run-<id>.json.corrupt` and restored Record |
| `R-10` | **not run — fixture blocked** | Needs a second account. The device holds a live session for `device.tester@zidrun.test` whose password is not in the repo, so signing out to test isolation risked stranding the fixture with no way back in. Not attempted |
| `R-11` | **pass** | 900 ms hold started the run (the regression that used to cancel) |
| `R-12` | **pass** | 400 ms hold started nothing; control returned to "Hold to begin" |
| `R-13` | **pass, partial** | With `animator_duration_scale 0` the 900 ms hold still starts the run. "No aura pulse" and "ring jumps between states" are animation properties a still frame cannot prove — not claimed |

## §5 Runs — live, summary, detail

| ID | Result | Evidence / note |
|---|---|---|
| `L-01` | **pass** | Compact panel, "Searching" + "Waiting for a usable signal. Time is counting; distance starts once the signal is good.", no map. Exposed to accessibility as one phrase |
| `L-02` | **not run** | No usable GPS fix indoors after 150 s of sampling; the panel never left "Searching". The *negative* assertion did hold throughout — the pill never read "Recording · Strong GPS" beside "Searching" |
| `L-03` | **not run** | Needs ≥2 route points, i.e. real movement |
| `L-04` | **not run** | Needs ≥2 completed km of real movement |
| `L-05` | **not run** | Needs sustained vehicle speed; no mock-location provider is installed on this device |
| `L-06` | **pass** | No reserved map; "No route was captured for this run."; explicit "This recording has no distance…"; Save inert, Discard reachable without scrolling |
| `L-07` | **pass** | "0.00 km in 2:13. You can add a title and notes next." — title and notes, never photos |
| `L-08` | **pass** | Splits, Elevation and Pace all render; pace line **green** in light, with a dashed average |
| `L-09` | **pass** | Distinct per-metric reasons: splits and pace "no per-point timing"; elevation "No elevation data was recorded on this route." |
| `L-10` | **pass** | Analyze run, Export GPX, Visibility ("Only you can see this run."), Delete this run — all four present |
| `L-11` | **fail → fixed → pass** | See **D-05** |

**Fixture observation, not a defect.** The timed seeded run reports 9.20 km and its charts span 0–9 km,
but the splits table stops at 5.96 km. The route is 8.83 km over 240 points spaced **10–20 s apart**,
and `computeSplits` drops any segment with a ≥15 s gap (`MAX_MOVING_GAP_S`) as GPS loss or a pause —
74 of 239 segments here. A real recorder samples every 1–5 s, so this is the seed's point spacing
showing through, not a product bug. Worth seeding denser points so `L-08`/`L-04` exercise the real path.

## §6 Coach

| ID | Result | Evidence / note |
|---|---|---|
| `C-01` | **pass** | "Free trial · 5 days left" beside the title; trial ends 2026-08-11 08:47, 4 d 7 h remaining → ceiling 5. "No pop-in shift" is a first-frame property not provable from a settled dump |
| `C-02` | **pass** | With `createdAt` set to 6 d 2 h ago: "Free trial · last day", not a vanished count |
| `C-03` | **pass** | Overview "Whole plan · 3 of 6 · Sessions completed" vs plan week "1 of 3 sessions this week" — different scopes, both labelled, no contradiction |
| `C-04` | **fail → fixed → pass** | See **D-07** |
| `C-05` | **pass** | Guided pre-selected (green), workout steps listed, Free run still selectable |
| `C-06` | **pass** | Ring reads "3" over "من 6" — Western digits on both lines |
| `C-07` | **pass** | `⁨6 × 800 m at 5K effort with 400 m jog recovery…⁩` wrapped in FSI/PDI, original order preserved |
| `C-08` | **pass** *(nit)* | `⁨3 أوت 2026, 17:30⁩` — isolated, not reordered. The runbook writes an Arabic comma `،`; the app emits a Latin `,`. Isolation holds either way |

**Fixture observation.** The seeded title "Intervals 6 × 800 m" promises 800 m reps, but the guided
engine builds 400 m reps for every `INTERVAL` (`workout-structure.ts`) and the real planner titles these
sessions plain "Intervals". The mismatch is in the hand-written seed, not between planner and engine.

## §7 Cross-cutting

| ID | Result | Evidence / note |
|---|---|---|
| `X-01` | **pass** | Stable states captured in light / dark / race. Race theme (neon on deep purple) holds contrast, no fallback; no orange body text in light — orange appears only as accent (streak icon, fastest-split bar, Finish button) |
| `X-02` | **pass** | "1 sortie", "série de 7 semaines", "1 séance sur 3 cette semaine", "sur 6", "08 AOÛT 2026"; no truncation or clipped CTA |
| `X-03` | **fail → fixed → pass** | Layout and tab order mirror correctly (tab bar re-derived from the dump, not fixed coordinates). Numeral consistency failed — see **D-06** — and passes after the fix |
| `X-04` | **pass** | At 1.3×: "TOTAL DISTANCE" wraps rather than ellipsizes, all content reachable, dock label readable, no unreachable action |
| `A-01` | **not run** | TalkBack was never enabled; spoken output cannot be verified over ADB, and the runbook itself says a hierarchy dump cannot prove it. Structural evidence only: "Step 2 of 3" is one merged phrase, icon-only actions are labelled (`Back`, `Search races`, `Run history`), and the GPS panel merges into a single description rather than several chattering nodes |
| `A-02` | **pass** | Registration, pre-run, live run and Coach under **three-button** and **gesture** navigation (`sec_gestural` overlay). No control or content under the system bars in either mode; Continue and Finish both clear the gesture hint bar |

### P-01 — cold start

Debug build, three-button nav, en / light / 1.0×, battery 85 %, 31.9 °C, not charging, one unrecorded
warm-up then five `am start -S -W` samples. Raw: `P-01-coldstart.txt`.

| Sample | 1 | 2 | 3 | 4 | 5 | median | range |
|---|---|---|---|---|---|---|---|
| `TotalTime` (ms) | 2441 | 2317 | 2298 | 2312 | 2250 | **2312** | 191 |

A debug, JIT-only build with no baseline profile — a regression lead, never signed-release acceptance,
and comparable only against the same package, build type, device, fixture and command.

### P-02 — scroll frames

Reset before each surface, five flings down and five back up at a fixed 400 ms each. Raw:
`P-02-<surface>-framestats.txt`.

| Surface | Frames | Janky | p50 | p90 | p95 | p99 | >100 ms | Frozen (>700 ms) |
|---|---|---|---|---|---|---|---|---|
| Run history | 434 | 132 (30.4 %) | 21 ms | 36 ms | 48 ms | 77 ms | 4 | **0** |
| Races list | 369 | 126 (34.2 %) | 23 ms | 61 ms | 77 ms | 97 ms | 3 | **0** |
| Run detail (charts) | 465 | 64 (13.8 %) | 21 ms | 30 ms | 32 ms | 48 ms | 1 | **0** |
| Coach overview | 449 | 37 (8.2 %) | 21 ms | 27 ms | 31 ms | 34 ms | 0 | **0** |

No frozen frames on any surface. The two list surfaces carry the most jank; on a debug build (no R8,
JIT-only, no baseline profile) that is expected and is a lead to re-measure on the signed candidate,
not a finding on its own. The Runs overview is not scrollable at this fixture size, so it has no
capture — recorded here rather than silently omitted.

## Companion automated gates (§8)

Re-run after every change in this session, all green: `assembleDebug`, `:feature:runs` and
`:feature:coach` unit tests, lint on runs/coach/registration/core-design/app; `check:native-i18n`
(545 keys × en/fr/ar), `test:registration`, `test:mobile-api` (111), `test:coach-mobile` (165),
`test:coach` (adaptive planner 68, coach memory 42), `test:tts-claim` (13).

These are source and API gates. They do not stand in for any physical case above.

## Teardown (§9)

Outbox empty; the two registrations created in §3 deleted (the account is back to its original
`alger-10k` + `seeded-race-38`); seeded BaridiMob/CCP on `tizi-ouzou-trail-challenge` reverted to null;
the workout moved for `C-04` restored to 2026-08-05 06:00; the temporary third category deleted and
`Trail 50K` returned to its own race; `User.theme` back to `light` and `createdAt` back to
2026-08-04 08:47:07.925; `font_scale` 1.0, `animator_duration_scale` 1, app locale `en`, three-button
navigation restored, stay-awake off. TalkBack was never enabled.
