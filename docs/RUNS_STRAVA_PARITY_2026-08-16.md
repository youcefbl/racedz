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

### 07.2 Background retry of a pending save (decided 2026-08-16)

- **Trigger:** only after the runner pressed Save and the request failed (offline, timeout, 5xx).
  The worker never uploads a finished run the runner has not asked to save — the summary screen
  is where title, notes, effort, photos and visibility are chosen, and a silent upload would post
  defaults over them.
- **What is retried:** the exact `CreateRunRequest` the failed save built (title, notes, effort,
  photos, visibility, laps, sport, coach ids), written into the existing outbox slot with
  `saveRequested = true`. The recorder's periodic snapshot never overwrites a `saveRequested`
  slot. `clientId` makes the retry idempotent server-side (`(userId, clientId)` unique).
- **Work:** one `OneTimeWorkRequest` per pending run, unique name
  `run-sync:<ownerUserId>:<clientId>` with `ExistingWorkPolicy.KEEP`, tag `run-sync`,
  `NetworkType.CONNECTED`, exponential backoff from 30 s, WorkManager's own persistence covers
  Doze and reboot. Enqueued on the failed save and again on app start when a `saveRequested`
  slot exists.
- **Account isolation:** the worker reads the slot for the account it was enqueued for and posts
  only if that account is the one currently signed in (`SessionManager.state`); otherwise it
  returns success without touching the file (the slot stays for its owner). Sign-out cancels the
  `run-sync` tag. A revoked/expired session fails the request as unauthenticated → the worker
  returns failure (no retry) and the slot stays for the next foreground attempt.
- **Success:** the slot is cleared exactly as a foreground save clears it, the recorder is reset
  if it still holds that `clientId`, and a signal (`RunRecorder.syncedRunIds`) lets an open
  summary navigate to the saved run. No notification is posted (the runner asked to save; the
  history list will show it) — a later slice may add one.
- **No duplicate saves:** unique work + server idempotency; the foreground Save button is disabled
  while a background attempt for the same `clientId` is running (WorkManager state observed).
- **Dependency:** `androidx.work:work-runtime-ktx` — named in `NATIVE-005` from the start.

### 07.6 Barometric elevation (decided 2026-08-16)

- **Hardware detection:** `Sensor.TYPE_PRESSURE` at recording start; absent (the Galaxy M21 has
  none) → GPS altitude exactly as today. Never a permission; never a reason to fail the run.
- **What the barometer replaces:** elevation *gain* (`elevationGainM`) and the `ele` of new route
  points. Gain is accumulated from a low-pass-filtered relative altitude with a 1 m hysteresis,
  so pressure noise cannot invent climb on a flat road the way GPS altitude does.
- **Calibration:** relative altitude from the hypsometric formula against the pressure at the
  first usable fix; the absolute anchor is that fix's GPS altitude, so route `ele` stays in metres
  above sea level for the server's elevation profile. No re-anchoring mid-run: weather drift over
  a run is a few metres and re-anchoring to noisy GPS altitude would be worse. Pause/resume keeps
  the anchor; a new run re-anchors.
- **Honesty:** the recording state names its `elevationSource` (`GPS` / `BARO`); nothing is shown
  as absolute altitude beyond what the route already carried. Server-side elevation resolution
  and the detail chart are unchanged.

### 07.7 Touch guard — placement proposal (approved by the owner as proposed, 2026-08-16)

- **Discoverable control:** a labelled 44 dp Lock icon button at the trailing end of the status
  header row ("Recording · GPS strong … 🔒"), always visible while recording/paused. No hidden
  gesture, no long-press on a header (owner ruled that out).
- **Locked state:** the live numbers stay readable (map and tiles untouched, slightly dimmed);
  every control on the screen ignores taps; a full-width "Hold to unlock" pill sits in the thumb
  zone with the same 700 ms hold + progress ring as the start control, latched at 100 %; TalkBack
  gets a plain activate action on it (like `HoldToBegin`), so switch/voice access can unlock.
- **Preserved:** system Back still minimises (the run keeps recording — a stray swipe never ends
  a run); notification Pause/Resume keep working (deliberate: they need the shade, which is a
  deliberate act); the countdown, finish dialog and lap confirmation are unaffected because they
  cannot be reached while locked. Screen stays awake as today.
- **Persistence:** lock state lives in the recorder (`RecordingState.touchLocked`) so minimise/
  return and process recreation restore it; unlocked automatically on Finish/Discard.
- **Not proposed:** a hardware-button unlock (varies by OEM), auto-lock after N seconds (a runner
  glancing at the phone should not find it locked without asking).

### 07.3 BLE heart rate — contract (approved 2026-08-16: tile swap; ships without hardware verification)

- **Permissions:** API 31+: `BLUETOOTH_SCAN` (`neverForLocation`) + `BLUETOOTH_CONNECT`, asked
  from the sensor row on the start screen, never at app start; API 26–30: `BLUETOOTH` +
  `BLUETOOTH_ADMIN` and location for scanning (Android's rule). Denied → the row explains, no HR,
  no retry loop.
- **Pairing:** a "Heart-rate sensor" row on the start screen (below Auto-pause) opens a sheet that
  scans for the Heart Rate Service (0x180D) for 15 s, lists devices by name, remembers the last
  address per device (`RunSettings.hrSensorAddress`); connect on start, GATT notify on 0x2A37
  (flags byte → 8/16-bit value), reconnect with backoff while recording, disconnect on Finish/
  Discard/sign-out. Battery: one connection, notify only, no polling.
- **Honesty:** states are Off · Searching · Connected · Reconnecting · Unsupported (no BLE) · Not
  found; the tile shows "—" in every non-Connected state; nothing is ever estimated.
- **Data:** average HR over moving time → `CreateRunRequest.averageHeartRate` (server already
  accepts 30–250); the live series is not stored (no server column) — noted for a later slice.
- **Design point for the owner:** `03-during-run.png` shows *Heart rate* as the second big tile
  where we show *Avg pace*. Proposal: when a sensor is connected the second tile becomes Heart
  rate and Avg pace moves to the secondary row (replacing Calories); with no sensor nothing
  changes. Alternative: a fourth small stat instead.

### 07.4 Beacon — contract (deferred by the owner 2026-08-16; web UI out of scope)

- A beacon is a share link that a non-user opens in a browser: it *is* website UI (a public page
  showing a moving dot), which the current brief excludes. Proposed minimum if the owner lifts
  that for this feature only: `POST /api/v1/runs/beacon` (explicit consent switch on the start
  screen; creates a 32-byte token, `expiresAt = now + 8 h`, revocable), `PUT …/beacon/{token}`
  every 30 s while recording with `{ lat, lng, at }` (last point only, retained 24 h then
  deleted), `DELETE` on Finish/logout/expiry, `GET /beacon/{token}` public page with the point and
  "live · updated 12 s ago", rate-limited per token. Not started.

### 07.5 Routes — contract (deferred by the owner 2026-08-16)

- Needs: a routing/planning source (draw on map vs. GPX upload only), a route store
  (`RunnerRoute` with bounded points), a follow mode with off-route threshold (proposal 40 m for
  8 s → voice + haptic), and a decision on tiles for planning (OSM raster as today, no SDK).
  Proposal for the first slice: **GPX-based routes only** (import a GPX as a route, list, follow
  with off-route alerts) — no drawing UI, no third-party routing. Not started.
