# ZidRun Coach — Audio Coaching Plan (voice-guided training sessions)

> Companion to [execution-plan-coach.md](execution-plan-coach.md). This delivers the "coach that
> talks to you mid-run, in your language" experience: **audio guidance only — no music playback,
> no music control, no mixing.** The voice and tones ARE the audio experience. Spoken cues in
> English, French, and Arabic via **on-device TTS — zero AI/runtime cost, works offline.**
> No global running app speaks Arabic to runners mid-workout; this is a differentiator ZidRun
> can own.
>
> Each training type gets its **own audio guidance profile** — an interval session is coached
> differently from a recovery jog. Sessions come from two doors: the **coach's planned workout**
> (profile auto-selected from the workout type) or the **runner's own choice** from a guided
> session library (strides, Norwegian 4×4, recovery run, long run, splits/intervals) — no active
> plan required, which also serves the free-runner track (plan §1.6).

> **Branch update (2026-07-16 — `feat/audio-coaching`).** Phases A–D are implemented: native TTS
> speech with Arabic-availability fallback and the cue-density gate (A); the deterministic profile
> engine, pace bands from the runner's 28-day average, anti-nag scheduler, and en/fr/ar spoken copy
> (B); the guided session library — intervals, Norwegian threshold, strides, recovery, long run —
> with parameter pickers wired into the recorder (C); and the persisted voice-guidance setting with
> test-voice button and missing-voice hint (D). Deterministic checks: `npm run test:audio` plus new
> template cases in `test:workout`. **Phase E is what remains:** `npx cap sync`, an APK build, the
> on-device matrix (three languages, screen locked, Bluetooth), the Arabic/French copy review, and
> the release. Nothing here has run on a real device yet.

## Where we actually are (audited 2026-07-16)

Good news: this is an **upgrade, not greenfield**. The app already has:

- A structured-workout guidance engine ([use-workout-guidance.ts](src/components/coach/use-workout-guidance.ts))
  that tracks the current step from live run metrics, auto-advances on time/distance targets, and
  fires transition callbacks — wired into the recorder ([run-recorder.tsx](src/components/coach/run-recorder.tsx)).
- A cue layer ([cues.ts](src/lib/native/cues.ts)): tones, haptics, and spoken step announcements
  via `SpeechSynthesis`, localized en/fr/ar, primed from the Start button gesture.
- A structure builder ([workout-structure.ts](src/lib/coach/workout-structure.ts)) that derives
  warm-up / reps / recovery / cool-down steps from any `TrainingWorkout` **at runtime, no schema
  change** — new templates and profiles layer in the same way.

**The critical gap: the voice layer is silent on the product that matters.** `window.speechSynthesis`
does not exist in the Android WebView, and no native TTS plugin is installed — so on the APK the
`speak()` calls no-op (by design they degrade silently) and runners get only tones + haptics. Voice
currently works only in a desktop/mobile browser.

Other gaps:

1. One-size-fits-all cues: every workout type gets the same step announcements. No per-type
   coaching behavior (an interval rep, a strides set, and a recovery jog need different voices).
2. No session library: guidance exists only for a planned workout. A runner can't say "I want to
   do strides now" or "guide me through a Norwegian 4×4".
3. No pace coaching: no km splits, no pace-vs-target feedback, no "slow down — this is recovery".
4. No audio settings: no voice toggle, no cue-density choice, no way to test the voice pre-run.
5. Arabic voice availability varies by device (Google TTS language data); needs graceful fallback.
6. Screen-off behavior unverified: the foreground service keeps location flowing, but WebView JS
   timers can throttle with the screen locked — cue timing must be validated on a real device.

## Product decision: no music

The recorder does not play, pause, duck, or manage music in any form. Audio guidance is the sole
audio surface, designed to stand on its own: short spoken cues, distinct tones per situation, and
haptics. If a runner plays music from another app, the OS handles the overlap — that's outside our
product. This keeps the audio stack simple, predictable, and fully offline.

## The core new concept: audio guidance profiles

A **profile** = which cues fire, how often, and with what tone, for one training type. The
deterministic scheduler owns all of it (no AI in the loop — cues cost nothing and can never say
something unsafe). Profiles ship with the session templates below.

| Profile | Philosophy | Signature cues |
|---|---|---|
| **Intervals / splits** | Precision and drive | Rep announce ("Rep 4 of 8 — 400 m hard"), 3-2-1 countdown, rep split time at each rep end ("Rep 4 — 1 minute 32"), recovery start/end, "last rep" callout |
| **Strides** | Form, not pace | 6×20 s pickups + walk-back; GPS pace is meaningless over 20 s, so cues are **form cues** rotated per stride ("tall posture, quick light steps", "relax your shoulders", "smooth and fast, not forced"); time-based only |
| **Norwegian threshold (4×4 / sub-threshold)** | **Control — the enemy is going too hard** | Rep start with effort framing ("4 minutes at threshold — you should manage short sentences"), mid-rep control check ("halfway — stay controlled, don't push"), pace-**ceiling** warnings only ("too fast — back off"), 1-minute-left, recovery countdown |
| **Recovery run** | Protect the easy day | The ONLY pace cue is "slow down" (ceiling); never "speed up". Sparse check-ins (~every 5 min): "nice and relaxed — this is how recovery should feel". Minimal by design |
| **Long run** | Company over coaching | Km splits, halfway callout, hydration reminder every ~25–30 min, "last kilometre" encouragement, optional steady-pace drift hint. Sparse between markers |
| **Tempo** (existing type) | Sustained focus | Block start/end, km splits inside the block, pace band feedback both directions, "2 minutes left — hold it" |
| **Easy run** | Leave the runner alone | Km splits + gentle ceiling nudge only if drifting well above easy effort |

Pace bands are derived **deterministically from the runner's own recent average pace** (already in
the coach snapshot/metrics): e.g. recovery ceiling ≈ recent avg + 60–90 s/km, threshold band ≈
recent avg − a margin, with wide tolerances. No stored target pace → effort-language cues only.
Global anti-nag rules: minimum ~60–90 s between pace cues, never in a step's first 30 s, rolling
~200 m pace window so GPS noise doesn't trigger false cues.

## Two entry points

1. **Coach-planned workout** (exists today): the runner starts a planned session; the audio profile
   is auto-selected from `workoutType`. The deterministic planner can later emit richer sessions
   (e.g. a strides finisher on an easy day, a Norwegian threshold day) — the profiles are ready
   for it.
2. **Guided session library** (new): from the recorder, the runner picks a session directly —
   Strides, Norwegian 4×4, Recovery run, Long run, Intervals — with sensible defaults and small
   parameter pickers (reps, rep length, total duration/distance). No plan or goal required. The
   run records normally; the conservative matcher (plan §1.3) decides afterwards whether it counts
   toward a planned workout, so the adherence loop is untouched. Templates live client-side as
   structures — **no schema change**.

## Phases

### Phase A — Make the voice real on Android (the unlock)

- Add `@capacitor-community/text-to-speech` (version matching Capacitor 6).
- Refactor `speak()` in [cues.ts](src/lib/native/cues.ts) into a unified adapter: native TTS on
  Capacitor, `SpeechSynthesis` fallback on web/PWA, silent degrade elsewhere. Keep the existing
  "never throws into the recorder" contract.
- Locale/voice mapping (`en-US`, `fr-FR`, `ar` — native Android TTS handles Arabic far better than
  web voices), voice-availability detection, tones+haptics fallback when a voice is missing.
- Cue queue discipline: one utterance at a time, newest-priority (a rep transition beats a pending
  split announcement), short sentences only.

### Phase B — Profile engine + pace coaching

- A small deterministic cue scheduler beside `useWorkoutGuidance`: consumes live metrics + the
  active profile; emits km-split, mid-step, ceiling/band, countdown, and marker events.
- Pace-band derivation from recent runner metrics, with the anti-nag rules above.
- Per-profile cue rule tables (the table above, as code) for the existing types: INTERVAL, TEMPO,
  EASY, LONG_RUN, RECOVERY, RACE.
- All cue strings in the [copy.ts](src/components/coach/copy.ts) convention (en/fr/ar), warm and
  non-punitive; spoken-number formatting per locale (pace "5:42" said naturally in fr/ar). Arabic
  drafted in MSA with a Darija-leaning variant for the encouragement lines, for your review.

### Phase C — Guided session library (user-chosen training)

- New templates in [workout-structure.ts](src/lib/coach/workout-structure.ts): **Strides**
  (easy block + N×20 s pickups with walk recovery) and **Norwegian 4×4** (warm-up + 4×4 min
  threshold / 3 min jog + cool-down), plus parameterized variants of the existing interval/tempo/
  long/recovery builders.
- Library UI in the recorder flow: pick a session → adjust reps/duration with defaults → start.
  Works with no active plan (free-runner friendly).
- Planned-workout path auto-selects its profile; a planned workout whose title/type implies
  threshold work maps to the Norwegian-style controlled profile.

### Phase D — Audio settings + polish

- Pre-run audio sheet: voice on/off, cue density (**Full guidance / Essential only / Tones only**),
  "test voice" button (speaks one sample cue), persisted via `@capacitor/preferences`.
- "Essential only" = step transitions + countdowns + finish; no splits, no pace commentary.
- A one-line hint when the Arabic voice is missing ("Install Google Text-to-Speech Arabic for
  voice cues"), with graceful tones-only behavior either way.

### Phase E — Device QA + release

- Screen-off validation: cues must fire with the display locked during a real GPS run (foreground
  service alive; if WebView timer throttling delays transitions materially, drive cue timing from
  the location-callback cadence instead of timers).
- Test matrix (real device): each profile once, three languages, phone speaker + Bluetooth
  earbuds, DND mode, battery saver, Arabic voice missing (fallback path).
- APK release per the existing convention (bump `versionName`/`versionCode` above v1.3, build
  `zidrun-prod-debug-v<X.Y>.apk`).

## Who does what

### Claude (me) — all the code

| Task | Phase |
|---|---|
| TTS plugin integration, unified speak adapter, cue queue, fallbacks | A |
| Profile engine + deterministic pace bands + per-type rule tables | B |
| All cue copy drafts en/fr/ar + spoken-number formatting | B |
| Strides + Norwegian templates, session library UI, parameter pickers | C |
| Settings sheet, cue-density modes, persistence, test-voice button | D |
| Fixes from device QA; timer-throttling rework if needed | E |
| Unit-style checks for scheduler thresholds and profile rules (extend the `test:coach` script area) | B/E |

### Youcef (you) — the things only a human with the device and the language can do

| Task | Phase | Est. |
|---|---|---|
| `npm install` + `npx cap sync android` + build/install the APK after Phase A | A | ~30 min |
| First on-device smoke test: does it speak, all 3 languages? | A | ~30 min |
| **Review Arabic phrasing** — MSA vs Darija-leaning tone, correct my drafts (the differentiator; a native ear is non-negotiable) | B | ~1 h |
| Review French phrasing (quick pass) | B | ~15 min |
| Sanity-check the training content: rep/recovery defaults, Norwegian pacing philosophy, strides form cues (you know the running culture; flag anything a real coach would object to) | B/C | ~30 min |
| Decide defaults: cue density default, pace-cue tolerance/frequency, hydration reminder interval | B/D | ~15 min |
| Real outdoor runs with screen locked: one interval-style session + one easy/recovery session; note late/missing/annoying cues | E | 2 runs (~1½ h) |
| Version bump sign-off + APK release to testers | E | ~30 min |

## Estimation

| Phase | Claude coding | Your time | Elapsed (realistic) |
|---|---|---|---|
| A — native TTS unlock | 1 session (~1–2 h) | ~1 h | 1 day |
| B — profile engine + pace + copy | 2 sessions (~4–5 h) | ~2 h review | 2 days |
| C — session library + new templates | 1–2 sessions (~3–4 h) | ~30 min | 1–2 days |
| D — settings + polish | 1 session (~1–2 h) | ~15 min | ½ day |
| E — device QA + release | ~2 h of fixes | ~2 h + 2 runs | 2–3 days |
| **Total** | **~11–15 h of my work** | **~6 h of yours** | **~1½–2 weeks calendar** |

The long pole is not code — it's your on-device test runs and the Arabic copy review. **Phase A
alone is already shippable value** (the existing step announcements become audible on Android for
the first time) and can ride the next APK even if B–D follow later. A sensible first release is
A+B; the library (C) can be the release after.

## Cost

- Runtime: **$0.** On-device TTS, no API calls, works offline.
- Dependencies: one free MIT plugin (`@capacitor-community/text-to-speech`).
- The only "cost" is APK size (~negligible) and your QA time.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Arabic TTS data missing on some devices | Detect → tones+haptics fallback + settings hint; never a crash (A/D) |
| WebView JS throttled with screen off → late cues | Phase E validation first; fallback is driving cues from location-callback cadence |
| Pace cues feel naggy | Conservative defaults (60–90 s min interval, wide bands, 200 m smoothing), per-profile sparsity, "Essential only" and "Tones only" modes |
| GPS pace noise triggers false "slow down / too fast" | Rolling-window pace, wide tolerances, ceiling-only cues on recovery, no pace judgment at all on strides |
| Norwegian/threshold cues mislead effort without HR data | Effort-language framing ("short sentences" test) + ceiling-only pace warnings; HR-zone targets stay out of scope until HR data exists |
| Voice quality varies by device/engine | Short template sentences; "test voice" button sets expectations |
| PWA (non-APK) users | Web `SpeechSynthesis` fallback keeps parity where the browser supports it |

## Explicitly out of scope

- **Music, in any form** — no playback, no pause/duck/mix, no player controls. Product decision.
- AI-generated or streamed voice (ElevenLabs etc.) — cost + offline + safety say no.
- Heart-rate-based effort cues (no HR-zone targets in the workout structure yet).
- iOS (no iOS app exists).
- Recorded human voice packs — revisit only if TTS Arabic quality disappoints in QA.
