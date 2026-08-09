# Prompt: Build and Verify Native Android Coach

Copy this prompt into a new implementation session.

---

You are working in `/home/youcef/Documents/work/racedz` on ZidRun. Implement and verify the native
Android Coach experience on an emulator, using the existing Capacitor Coach experience as the
behavioral baseline and the approved Coach screenshots as the visual baseline.

Do not build a second Coach product. The native app must use the same server-authoritative Coach
contracts, privacy rules, safety rules, localization, and plan semantics as Capacitor. Fix confirmed
gaps that are in scope. For anything not safely fixable in this session, record a concrete action in
`EXECUTION_PLAN.md`; do not create a separate backlog or progress tracker.

## Required product rules

- Match the approved ZidRun Coach screenshots, design flow, font, logo, spacing, colors, radii, icon
  weight, card hierarchy, and chart/data treatment.
- Verify Light, Dark, and Race modes.
- Verify English, French, and Algerian Darija Arabic, including complete RTL mirroring.
- Preserve outdoor readability, one-handed use, large-text behavior, reduced motion, and 44dp touch
  targets.
- Never invent runner data or medical advice. Coach guidance is general training information, not a
  diagnosis.
- Do not send or expose email, phone, exact address, exact GPS, tokens, credentials, or unnecessary
  health data to the client, logs, screenshots, analytics, or AI provider.
- Do not commit `.env`, personal data, raw GPX, precise-location screenshots, tokens, or secrets.
- Do not commit code unless the user explicitly requests a commit.

## Read first

Read these before editing:

1. `EXECUTION_PLAN.md`
2. `AGENTS.md`
3. `PRODUCT.md`
4. `docs/TESTING.md`
5. `docs/MOBILE_ANDROID.md`
6. `docs/NATIVE_ANDROID_OPTION_PLAN.md`, especially the Coach phase and known gaps
7. `docs/COACH_CONTEXT_DATA_CONTRACT.md`
8. `docs/coach-design/COACH_DESIGN_FLOW.md` and every image in `docs/coach-design/images/`
9. `docs/native-design/NATIVE_APP_DESIGN_FLOW.md` and its relevant images
10. `.agents/skills/zidrun-app-review/SKILL.md`
11. `.agents/skills/impeccable/SKILL.md`

Inspect the existing implementations before changing them:

- Capacitor/web: `src/app/account/coach/page.tsx`, `src/components/coach/coach-dashboard.tsx`,
  `src/components/coach/coach-goal-form.tsx`, `src/components/coach/coach-overview.tsx`,
  `src/components/coach/coach-plan-panel.tsx`, `src/components/coach/coach-conversation.tsx`,
  `src/components/coach/coach-sleep-panel.tsx`, `src/components/coach/copy.ts`, and the Coach API
  helpers/routes under `src/app/api/coach/` and `src/app/api/v1/coach/`.
- Native: `native-android/feature/coach/CoachScreen.kt`, `CoachViewModel.kt`,
  `CoachOnboardingScreen.kt`, `CoachOnboardingViewModel.kt`, `PlanWeekScreen.kt`,
  `PlanWeekViewModel.kt`, `ConversationScreen.kt`, `ConversationViewModel.kt`, `SleepScreen.kt`,
  and the navigation/API/repository wiring in `native-android/app/` and `native-android/core/`.

The current native Coach work is not accepted merely because it compiles. The known native plan gaps
must be checked explicitly: planned workout handoff must preserve `workoutId`, Move and “I can’t
today” behavior must work or be documented, and voice input/TTS must be verified or documented.

## Emulator and server setup

Use a Pixel 8 emulator or equivalent API 34+ device. Keep Capacitor and native state separate when
comparing them. Record emulator model/API, package ID, branch, commit, locale, theme, network, and
test account before testing.

Start the local server with the emulator-facing Auth origin. A server already occupying port 3003
must be stopped or reused only after checking its redirect:

```bash
curl -sS -D - -o /dev/null http://127.0.0.1:3003/account/coach \
  | rg -i 'HTTP/|location:'
```

For Capacitor emulator testing, the redirect must use `10.0.2.2`, not `127.0.0.1`:

```bash
AUTH_URL=http://10.0.2.2:3003 \
NEXTAUTH_URL=http://10.0.2.2:3003 \
npm run dev:lan
```

If port 3003 is busy, identify the exact owner before stopping it:

```bash
ss -ltnp 'sport = :3003'
ps -eo pid,ppid,args | rg 'next dev|npm run dev:lan'
```

Build and launch native debug:

```bash
cd native-android
./gradlew :app:installDebug
adb shell am force-stop dz.racedz.nativeapp.debug
adb shell monkey -p dz.racedz.nativeapp.debug -c android.intent.category.LAUNCHER 1
```

Build and launch Capacitor against the same local server from the repository root:

```bash
CAP_SERVER_URL=http://10.0.2.2:3003 npm run android:dev
```

If Capacitor asks for a target, select `emulator-5554`. Confirm the app is loading the expected
server before evaluating Coach. Capture logs and screenshots in `/tmp`, never in the repository:

```bash
adb logcat -c
adb exec-out screencap -p > /tmp/zidrun-coach-<app>-<state>.png
adb logcat -d -t 800 | rg -i \
  'AndroidRuntime|FATAL|ANR|Capacitor/Console|nativeapp.debug|coach|openai|exception|error'
```

## Phase 1 — freeze the Capacitor baseline

On Capacitor, first record the actual working behavior, not assumptions:

1. Open Coach signed out, signed in with no Coach entitlement, trial/active entitlement, expired
   entitlement, no goal, goal with no plan, and goal with an active plan.
2. Complete the existing Capacitor onboarding from start to finish. Record every step, required and
   optional field, validation, profile-gap behavior, loading state, plan-generation state, success,
   retry, and server error.
3. Capture the resulting Coach Overview, Weekly Plan, Conversation, Sleep & Recovery, Memory/Privacy,
   subscription/locked state, and all empty/error/offline states.
4. Record the exact API requests/responses using safe local diagnostics. Redact tokens, email, phone,
   exact location, health notes, and free-text private data.
5. Record whether the plan is generated by the shared server and which fields are used. Do not treat
   differences in AI wording as a defect if the selected run, goal, plan, safety decision, and locale
   are equivalent.

The Capacitor baseline must answer:

- What happens when the runner has no profile data, no goal, no plan, or no entitlement?
- Which onboarding steps are shown or skipped when sex/date of birth already exist?
- How does the user generate, accept, refresh, move, skip, or decline a workout?
- How does “Log this run” enter the Runs flow, and is `workoutId` preserved?
- How does the runner ask a question, submit text/voice, retry, and return to Coach?
- How are safety warnings, data gaps, uncertainty, and missing metrics displayed?
- How are memory, privacy, export, deletion, and consent explained?

## Phase 2 — implement native parity

Implement or correct the native flow in this order:

### A. Coach entry and onboarding

- Coach opens into a clear loading, offline, error, locked/subscription, setup, trial, or active-plan
  state; no blank screen or infinite spinner.
- Native onboarding must follow the same information architecture as Capacitor and the approved
  five-step design: Goal, Background, Availability, Health & Safety, Review.
- Do not silently ask for profile fields already present on the server. If a profile gap exists, ask
  it at the appropriate step with plain language and retain the input when validation fails.
- Goal setup must support the server’s actual goal types, custom goal where allowed, target date/time,
  experience level, current weekly distance, recent/longest run where applicable, and available days.
- Availability must support everyday/7 days, 4 days, and 2 days. Enforce safe minimums from the shared
  server schema instead of accepting a UI-only value.
- Health and safety fields must be optional/consented according to the contract. Never fabricate
  injury, chronic-condition, heart-rate, weight, or height values.
- Save progress locally only when privacy-safe; do not silently submit health data. Back/cancel must
  preserve or discard predictably, and duplicate submits must be idempotent.
- After successful onboarding, show the generated-plan state, success state, and the first useful
  action. Do not leave the runner on a stale setup form.

### B. Coach Overview and plan

- Match the approved overview hierarchy: goal, today’s workout, weekly adherence, next workout, latest
  Coach review, one concise tip, and links to Plan, Runs, Sleep, Conversation, and Memory/Privacy.
- Weekly plans must communicate planned/completed/skipped/moved/rest states clearly without relying on
  color alone.
- Generate/review plan actions need progress, success, failure, retry, and stale-plan recovery.
- “Log this run” must carry the selected `workoutId` into the Runs flow and preserve it through save.
- Implement or explicitly document Move and “I can’t today,” including reason selection, server
  mutation, confirmation, rollback/retry, and updated adherence.

### C. Conversation and AI output

- Native Conversation must use the same `/api/v1/coach/interactions` contract and server safety rules
  as Capacitor; do not duplicate AI prompting or plan logic in Kotlin.
- Verify text input focus, keyboard avoidance, Arabic RTL, long responses, loading, timeout, rate
  limit, offline, retry, empty conversation, and duplicate-submit behavior.
- Verify voice transcription and TTS if the feature is exposed. If unavailable, hide or clearly mark
  it unavailable rather than presenting a dead control.
- Responses must respect the selected locale and explain uncertainty/data gaps.
- The Coach must not diagnose, prescribe medical treatment, invent metrics, infer missing injury data,
  or claim to have used signals that were not supplied.

### D. Sleep, recovery, memory, and privacy

- Match Capacitor’s Sleep & Recovery fields and explain how entries influence training guidance.
- Verify loading/save/error/retry and server-authoritative confirmation.
- Memory shows provenance, purpose, retention, consent, and forget/export controls. Health-memory
  writes remain governed by `docs/COACH_CONTEXT_DATA_CONTRACT.md` and `EXECUTION_PLAN.md`.
- Test account isolation: runner A must never see runner B’s goal, runs, conversation, sleep, memory,
  plan, or Coach response through IDs, cached screens, back navigation, or a stale native session.

## Required profile matrix

Use isolated test profiles. Do not use real people or real health data. “Young” and “older” mean adult
test bands, for example 18–25 and 60–70; do not create minors in the AI test matrix unless the product
has an approved youth policy and consent flow. “Pro” must map to the API’s actual `ADVANCED` value if
there is no `PRO` enum; do not invent a value the backend does not support.

At minimum, test these representative cases on Capacitor and native:

| Case | Age band | Sex | Experience | Availability | Expected checks |
|---|---:|---|---|---:|---|
| A | 18–25 | male | beginner | 2 days | conservative progression, rest preserved |
| B | 18–25 | female | beginner | 4 days | safe beginner volume and readable plan |
| C | 18–25 | male | advanced/pro | 7 days | no unsupported daily intensity, recovery retained |
| D | 18–25 | female | advanced/pro | 2 days | compressed schedule does not exceed safe load |
| E | 60–70 | male | beginner | 2 days | conservative intensity and clear safety language |
| F | 60–70 | female | beginner | 4 days | recovery spacing and age-aware guidance |
| G | 60–70 | male | advanced/pro | 7 days | advanced status does not remove safety limits |
| H | 60–70 | female | advanced/pro | 4 days | plan remains achievable and localized |

Also test boundary/error cases:

- missing sex and/or date of birth;
- zero/negative/non-numeric weekly distance;
- fewer than the server-supported minimum training days;
- target date in the past or unreasonably soon;
- empty custom goal and maximum-length custom goal;
- server timeout, AI provider failure, rate limit, offline, duplicate submit, and app force-stop;
- changing language/theme during onboarding and after a plan exists;
- editing an existing goal without silently replacing the active plan.

For each case, compare the server response and visible native output with Capacitor. Confirm the
number of planned sessions equals the selected availability, rest days are respected, the goal/date
are correct, and no unsupported or fabricated signal appears.

## AI-output review checklist

For every profile, inspect at least:

- goal and target date reflected correctly;
- weekly volume and experience reflected correctly;
- number and spacing of workouts match 7/4/2-day availability;
- young/older adult differences are conservative and not stereotyped;
- male/female selection does not create unsupported medical claims or biased language;
- beginner/pro differences affect progression without unsafe intensity jumps;
- rest, recovery, warm-up, cool-down, and injury caution are present where appropriate;
- missing heart rate, elevation, sleep, weather, or injury data is acknowledged rather than invented;
- no exact GPS, email, phone, credentials, prompt/context dump, or unrelated runner data is disclosed;
- response locale is correct, Algerian Darija is natural, and Arabic layout is fully RTL;
- no prompt-injection text from user notes, run titles, or imported files is treated as an instruction.

Compare semantic output and safety decisions, not random AI phrasing. If the native app receives a
different context or calls a different endpoint, fix the shared API mapping before adjusting UI copy.

## Strict UI/UX review

Inspect screenshots for every critical state in Light, Dark, and Race:

- loading, empty, locked, setup, each onboarding step, validation error, submitting, generated plan,
  active plan, no-plan, conversation, sleep, memory/privacy, offline, and retry;
- approved logo and native font tokens;
- high-contrast surfaces and readable long Coach text;
- cards/chips/buttons aligned with the screenshots, no clipped French or Arabic text;
- thumb-reachable Continue/Back/Save/Ask actions;
- keyboard scrolls the focused field into view;
- Arabic mirrors layout and control order semantically while numbers and maps remain readable;
- reduced motion removes decorative transitions but preserves state feedback;
- TalkBack labels announce progress, selected choices, validation, plan status, and destructive
  privacy actions.

Reject a screen that only looks correct in English/Light or only works after a refresh.

## Performance and reliability

Measure on the emulator and record the method:

- cold/warm launch and Coach entry;
- onboarding step transitions and keyboard response;
- plan generation loading time, timeout, cancellation, and retry;
- scroll performance for the overview/weekly plan/conversation;
- memory growth after switching between Coach, Runs, and Account;
- no ANR, crash, UI-thread network work, unbounded conversation/history fetch, or infinite retry;
- logout/account switch clears private Coach data according to the native security contract.

Use:

```bash
adb shell dumpsys gfxinfo dz.racedz.nativeapp.debug
adb shell dumpsys meminfo dz.racedz.nativeapp.debug
```

## Fix or document gaps

1. Fix confirmed P0/P1 issues and clear P2 issues that are small and safe.
2. Keep AI/domain behavior server-authoritative; do not patch a single client with fake plan data.
3. Add focused tests for API mapping, onboarding validation, availability, locale/theme state,
   workout handoff, privacy/authorization, and error/retry behavior.
4. For every unresolved gap, update `EXECUTION_PLAN.md` with a stable issue ID, severity, affected
   client, reproduction, screenshot/log evidence, expected behavior, implementation plan, privacy/
   accessibility/performance impact, and acceptance test.
5. Update `docs/NATIVE_ANDROID_OPTION_PLAN.md` only when its native phase/evidence is genuinely changed;
   do not create a competing tracker.
6. Re-run the affected emulator flow and focused checks after each meaningful fix.

## Required final report

Return a strict evidence report containing:

- branch/commit, native package/version, Capacitor version, emulator/API, locale, theme, network, and
  test account type;
- Capacitor baseline versus native comparison table;
- profile matrix results for all eight cases and boundary cases;
- AI semantic/safety/context parity results;
- screenshots/logs/tests used as evidence;
- ordered P0–P3 findings with concrete acceptance criteria;
- files changed and checks run;
- unresolved gaps recorded in `EXECUTION_PLAN.md`;
- explicit list of untested features;
- final status: `PASS`, `PASS WITH OPEN P2/P3`, or `BLOCKED`.

Do not approve the native Coach if onboarding cannot complete, plan availability is wrong, Coach
context differs from Capacitor, a privacy boundary fails, a P0/P1 remains, or any required theme,
locale, RTL, accessibility, or error state was skipped.

Begin by printing the exact test matrix, package IDs, server URL, and current native Coach gaps, then
run the Capacitor baseline before editing native code.
