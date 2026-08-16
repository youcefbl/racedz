# Run recording — Strava parity review (2026-08-16)

Source: Strava (com.strava) driven over Wi-Fi ADB on the Galaxy M21 — Record tab, drawer,
Settings (Auto Pause / Audio Cues / Beacon / Live Segments / Screen Lock / Sensors / Route alerts /
Track laps) — compared against `native-android/feature/runs` as of `d675def`.

Only the **record → save → review** loop is compared. Social/feed, clubs, challenges and the
premium analytics tiers are out of scope for now.

## What ZidRun already has that Strava's free tier does not

Weather card before start, guided/structured workouts with per-step voice, cloud TTS fallback for
Arabic, mid-run coach Q&A, non-foot (vehicle) detection live + at save, GPX import on-device,
crash-safe outbox with cross-account isolation, perceived effort at save, workout-match confirm.

## Gap list, by priority

Status key: ✅ delivered this pass · ◐ partial · ☐ open.

### P0 — recording correctness and the "at arm's length" basics

| # | Feature | Strava | ZidRun before | Status |
|---|---|---|---|---|
| 1 | Keep the screen on while recording | yes (+ Screen Lock modes) | screen slept mid-run; runner had to wake+unlock to glance | ✅ `RecordingScreen` holds `keepScreenOn` for its lifetime |
| 2 | Auto-pause when standing still (traffic lights) | Auto Pause: Off / Run / Ride | only the vehicle-speed pause; the clock kept running at a red light | ✅ stationary auto-pause + auto-resume in `RunRecorder`, `RunSettings.autoPauseEnabled` toggle on the start screen, persisted |
| 3 | Smoothed current pace | rolling | raw `Location.speed` per fix — jumps ±1:00/km between fixes | ✅ 12 s rolling window over accepted segments (`PaceWindow`) |
| 4 | Audio cues: start / pause / resume / finish | yes | only km splits + guided steps | ✅ `RunVoice` says started/paused/resumed/finished (finish includes distance + time) |
| 5 | Audio cue interval | Distance: off / 0.5 / 1 / 2 km (+ time) | fixed 1 km | ✅ `RunSettings.cueIntervalKm` chooser (Off / 0.5 / 1 / 2), persisted; each cue = distance, elapsed, last-split pace |
| 6 | Notification controls | pause/resume from the notification | text only | ✅ Pause / Resume actions on the foreground notification |
| 7 | Haptic on split / auto-pause | yes | none | ✅ light tick on each split, double tick on auto-pause/resume |

### P1 — the save/review loop

| # | Feature | Strava | ZidRun | Status |
|---|---|---|---|---|
| 8 | Visibility (Everyone / Followers / Only me) at save | yes | only after save, on detail | ☐ add an `isPublic` switch to `RunSummaryScreen`, send in `CreateRunRequest` |
| 9 | Edit title / notes / effort after save | yes | not possible on native (`PATCH` exists server-side) | ☐ edit sheet on `RunDetailScreen` using `runUpdateSchema` + `baseRevision` |
| 10 | Best efforts (fastest 1k / 5k / 10k, PR badge on the run) | yes | only totals (longest, best avg pace) | ☐ client-side from `paceSeries`/route on detail; server later |
| 11 | Live map: follow-me marker, pan/zoom, heading | yes | static auto-fit tiles, no marker | ☐ current-position dot + follow; pan/zoom is a bigger lift |
| 12 | Manual lap button ("Track laps") | yes | no | ☐ lap marker in state + lap list; splits stay per km |
| 13 | Countdown 3-2-1 (optional) | yes | hold-to-start only | ☐ optional, off by default |
| 14 | Units km / mi | yes | km hard-coded | ☐ account setting; low priority for Algeria |
| 15 | Share image of a run | yes | GPX share only | ☐ bitmap of map + stats |
| 16 | Live cadence tile | yes (with sensor) | measured but only shown after save | ☐ trivial once step data is live |

### P2 — platform features (need backend or hardware)

| # | Feature | Notes |
|---|---|---|
| 17 | Sport type (run / walk / trail / ride) | needs a `RunnerRun.sport` column + validity rules per sport; today everything is a run and rides get flagged non-foot |
| 18 | Background retry of a failed save (WorkManager) | still `NATIVE-005`; the outbox already makes it idempotent |
| 19 | BLE heart-rate sensor | server accepts `averageHeartRate` already; needs BLUETOOTH_CONNECT + GATT |
| 20 | Live location share (Beacon) | new endpoint + short-lived public link |
| 21 | Routes: plan / follow / off-route alerts, route library | large; needs routing/tiles decisions |
| 22 | Segments / live segments | out of scope |
| 23 | Barometric elevation | `TYPE_PRESSURE` unused; GPS altitude only |
| 24 | Screen-lock (touch guard) mode | Strava "Screen Lock: Normal / …"; a tap-guard overlay on the live screen |

## Design notes for the P0 delivery

- **Auto-pause** triggers after `STATIONARY_AUTO_PAUSE_SECONDS` (5 s) of usable fixes that fail
  the moving-speed rule, and auto-resumes on the first fix at ≥ `AUTO_RESUME_SPEED_MPS` (1.0 m/s).
  The vehicle pause is separate and never auto-resumes (unchanged). Both surface as
  `RecordingState.autoPauseReason`; only the stationary one is a setting.
- **Pace window**: pace over the accepted segments of the last 12 s (`PaceWindow`), falling back to
  the fix's own speed when the window has one segment. Shown as "—" once nothing was accepted for
  15 s (`MAX_MOVING_GAP_S`), so a stopped runner is not shown a stale pace.
- **Cues** are built outside composition like the existing ones; state-change cues (pause/resume)
  are keyed on `RecordingStatus` transitions and skip the initial Acquiring→Recording edge (that is
  "started"). Settings persist in `SharedPreferences` (`run_settings`), except `audioCuesEnabled`,
  which stays per-run on purpose (see `RunSettings`).

## NATRUN-07 contract decisions (written before each item, per the owner's rule)

### 07.1 Sport type (decided 2026-08-16)

- **Storage:** Prisma enum `RunSport { RUN, WALK, TRAIL, RIDE }`, column `RunnerRun.sport` with
  `@default(RUN)`; migration adds the enum + column, existing rows become `RUN` — backward
  compatible for every client that does not send it.
- **API:** `POST /api/v1/runs` (and the web create schema) accept `sport` (optional, default
  `RUN`); every run DTO returns `sport`; `GET /api/v1/runs?sport=RUN|WALK|TRAIL|RIDE` filters.
  No PATCH of sport (a mistaken sport is a delete-and-re-record; editing it would silently move a
  run in and out of records).
- **Validity / non-foot rule:** the motion check (`detectNonFootActivity`) runs for `RUN`, `WALK`
  and `TRAIL` only. A `RIDE` is never flagged non-foot (it is not on foot by declaration) but is
  also never counted where a run counts: excluded from best efforts/PRs, running badges, coach
  running volume, and the on-foot streak — the same places a SUSPECT run is excluded today.
- **Best efforts / PR:** derived only for `RUN` and `TRAIL`; the PR comparison is **within the
  same sport** (`RunBestEffort` gains no column — the comparison joins the run's `sport`), which is
  what the owner asked the 06.3 design to allow for.
- **Native:** a sport chip row on the start screen (Run · Walk · Trail · Ride, default Run, last
  choice remembered per device in `RunSettings`), carried in `RecordingState.sport` →
  `CreateRunRequest.sport` → outbox; the on-device non-foot warning is skipped for a ride; history
  rows and Run Details show a sport icon/label; history gains a sport filter row; manual entry and
  GPX import get the same chip row (default Run).
- **Not in this slice:** per-sport pace zones/coach advice, ride-specific metrics (speed instead
  of pace), sport-specific badges.
