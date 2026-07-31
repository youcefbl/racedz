# Prompt: Capacitor vs Native Android Runs, Coach, and Account Review

Copy this prompt into a new implementation/review session.

---

You are working in `/home/youcef/Documents/work/racedz` on ZidRun. Your job is to run a strict,
evidence-based comparison of the Capacitor Android app and the native Android app, then fix the
gaps that are safe and in scope. If a gap cannot be fixed in this session, record it with a concrete
remediation plan in `EXECUTION_PLAN.md`; do not create another backlog or progress tracker.

## Non-negotiable product rules

- Use the approved screenshots and flows as acceptance references, not as inspiration.
- Preserve the ZidRun logo, existing font tokens, spacing, colors, radii, icons, and chart treatment.
- Verify Light, Dark, and Race modes.
- Verify English, French, and Algerian Darija Arabic, including full RTL behavior.
- Compare native behavior against Capacitor, but do not copy a known Capacitor defect.
- Treat privacy, authorization, accessibility, and performance as release requirements.
- Do not commit `.env` files, GPX files, screenshots containing precise locations, tokens, or user
  data. Do not commit changes unless the user explicitly asks for a commit.

## Read before testing or editing

Read these completely or as required by the repository instructions:

1. `EXECUTION_PLAN.md`
2. `AGENTS.md`
3. `PRODUCT.md`
4. `docs/TESTING.md`
5. `docs/MOBILE_ANDROID.md`
6. `docs/NATIVE_ANDROID_OPTION_PLAN.md`
7. `docs/COACH_CONTEXT_DATA_CONTRACT.md`
8. `docs/runs-design/RUNS_DESIGN_FLOW.md` and every image in `docs/runs-design/images/`
9. `docs/coach-design/COACH_DESIGN_FLOW.md` and every image in `docs/coach-design/images/`
10. `docs/account-design/ACCOUNT_DESIGN_FLOW.md` and every image in
    `docs/account-design/images/`
11. `docs/native-design/NATIVE_APP_DESIGN_FLOW.md` and every image in
    `docs/native-design/images/`
12. `.agents/skills/zidrun-app-review/SKILL.md` and `.agents/skills/impeccable/SKILL.md`

Identify the exact current commit, branch, Capacitor package, native package, server URL, device
model/API level, locale, theme, network state, and test account before making changes.

## Start two isolated Android test environments

Use two emulators at the same time when possible:

- Emulator A: Capacitor app.
- Emulator B: native Android app.

Use separate AVDs or separate emulator instances so state, permissions, app data, and logs cannot be
confused. If only one emulator is available, run the same test matrix sequentially and label every
screenshot and log with the app under test.

Start the local server using the repository instructions. For the Capacitor emulator use the
configured emulator URL (`http://10.0.2.2:3003` for a local server), then run the documented sync and
Android install command. For native Android use the native debug build/configuration documented in
`docs/NATIVE_ANDROID_OPTION_PLAN.md` and install the correct debug package. Confirm both apps are
actually talking to the same server and API environment before comparing data.

Capture diagnostics without leaking secrets:

```bash
adb devices
adb shell getprop ro.build.version.release
adb shell getprop ro.product.model
adb logcat -c
adb logcat -d -t 500 | rg -i "AndroidRuntime|FATAL|ANR|capacitor|chromium|exception|error"
adb shell dumpsys gfxinfo <package>
adb shell dumpsys meminfo <package>
```

Use `adb exec-out screencap -p > /tmp/<app>-<screen>-<state>.png` for evidence. Keep precise GPS,
session tokens, personal details, and raw GPX outside Git.

## Accounts and test data

Use an isolated test account or the repository's documented demo runner account. Use the same runner,
goal, recent runs, locale, theme, and server data for both apps. Do not use the owner’s personal
account or real private activity. If one app creates data that the other must read, wait for the
server-confirmed save and verify the response before continuing.

## Test order

Run the baseline flow in English/Dark first, then repeat the critical states in Light, Race, French,
and Algerian Darija Arabic/RTL. Record a pass/fail for each app separately and a parity result for
each step.

### 1. Launch and shell

For both apps:

- cold launch, warm launch, splash/session restore, signed-out and signed-in states;
- bottom navigation and back behavior;
- safe areas, status/navigation bars, keyboard insets, rotation if supported;
- no owner identity, local paths, framework/version banners, debug details, or tokens in UI/logs;
- logo and typography match the approved native design.

### 2. Runs overview and run history

Open Runs and compare the two apps against the approved Runs screenshots and flow:

- overview hierarchy, weekly summary, latest run, achievements/personal record, quick actions;
- Create New Run entry point and history entry point;
- runs list search/filter/empty/loading/error/offline states;
- newly saved run appears immediately without a manual refresh;
- run detail route, splits, compact X/Y chart labels, map/privacy state, Coach analysis action;
- accessibility labels, 44dp touch targets, thumb reach, pressed/disabled/focus states.

### 3. Record and save a run end to end

“Register a run” means record and save a run. Test the complete lifecycle on both apps:

1. Open Create New Run.
2. Verify free/guided/planned mode behavior and the approved hold-to-begin interaction.
3. On a clean app state, verify location and background-activity permission rationale, denial,
   retry, and granted states. Do not silently grant permissions without recording that fact.
4. Confirm GPS acquiring/ready behavior. A stale first fix must not show the runner in the wrong
   city; the map should remain appropriately hidden or marked as settling until a stable route exists.
5. Start with the new animation. Capture ready, partial hold-progress, completed hold, and reduced-
   motion states. Check orange center glow, green foot border/progress, clipping, contrast, and that
   the animation does not delay or block input.
6. Walk/run a controlled short route or use the documented emulator location method. Confirm live
   distance, duration, pace, heart rate/elevation availability states, route drawing, GPS status,
   pause/resume, background/lock-screen behavior, and battery/network handling.
7. Finish the run. Verify pending summary, Save, Discard, back behavior, duplicate taps, interrupted
   save, offline save/retry, and the behavior when the user does nothing on the save/discard screen.
8. After Save, confirm server-authoritative success, immediate insertion in Runs List, highlight or
   acknowledgement of the new item, correct Run Details, privacy default, and no refresh requirement.
9. Reopen the same run after app restart and verify data consistency across Capacitor and native.
10. Delete or discard only isolated test data and verify the result is reflected in both clients.

For every state, record the expected result, actual result, screenshot path, log evidence, and whether
the issue is shared backend behavior, Capacitor-only, native-only, or visual parity.

### 4. Coach context and analysis

Use the newly saved run from Run Details and test Coach in both apps:

- tap Analyze run and confirm the selected run is the one being analyzed;
- verify distance, duration, pace, splits, effort, weather availability, and data gaps are handled
  consistently;
- ask at least these questions in each app:
  - “What did I do well in this run?”
  - “What should I change in my next session?”
  - “Was this effort appropriate for my current goal?”
- confirm responses use the same runner goal, recent-run history, plan/adherence, and selected run;
- confirm the Coach does not invent missing heart-rate/elevation/weather data;
- test text input, keyboard focus/scrolling, submit/loading/error/retry, voice/transcription if
  available, and offline behavior;
- verify language of responses follows the selected locale and Arabic responses are usable in RTL;
- compare the visible Coach result and, where available in safe local diagnostics, the request/response
  contract between Capacitor and native;
- confirm context privacy: no email, phone, exact address, exact GPS coordinates, auth data, tokens,
  or unnecessary private fields are exposed in the UI, logs, analytics, or client payload;
- verify Coach memory/privacy controls, consent language, deletion behavior, and account isolation.

Use `docs/COACH_CONTEXT_DATA_CONTRACT.md` as the source of truth. A visually similar Coach screen is
not parity if it analyzes a different run or receives incomplete/unauthorized context.

### 5. Account and privacy

For both apps verify:

- Account Overview matches the approved screenshot hierarchy and does not overexpose identity or
  location;
- profile/preferences editing, server-confirmed save, validation, retry, and keyboard-safe focus;
- Light/Dark/Race selection persists and applies to all relevant screens;
- English/French/Algerian Darija selection persists, preserves route/scroll where possible, and fully
  mirrors Arabic RTL without broken icons, chevrons, map graphics, or numeric values;
- notification, private activity, precise-location, Coach memory, export, and deletion controls;
- logout/account switch revokes or purges local private data according to the security contract;
- unauthorized user cannot access another runner’s run, GPX, Coach context, payment/private media, or
  account data through IDs, deep links, cached screens, or back navigation.

## Strict comparison matrix

Create a table in the final review with these columns:

| Area | Capacitor evidence | Native evidence | Expected reference | Result | Owner/action |
|---|---|---|---|---|---|
| Runs overview | screenshot/state | screenshot/state | approved flow/image | pass/gap | fix or plan |
| Start animation | ready/progress/complete | ready/progress/complete | approved interaction | pass/gap | fix or plan |
| Recording/save | lifecycle evidence | lifecycle evidence | Runs flow | pass/gap | fix or plan |
| Run details | metrics/Coach link | metrics/Coach link | approved image | pass/gap | fix or plan |
| Coach context | analyzed run/questions | analyzed run/questions | data contract | pass/gap | fix or plan |
| Account/privacy | state/screens | state/screens | Account flow | pass/gap | fix or plan |
| Theme/locale/RTL | matrix result | matrix result | design invariants | pass/gap | fix or plan |
| Accessibility | TalkBack/focus/targets | TalkBack/focus/targets | review checklist | pass/gap | fix or plan |
| Performance | measured evidence | measured evidence | review thresholds | pass/gap | fix or plan |

## Performance and reliability checks

Measure, do not guess:

- cold/warm launch and first usable screen;
- Runs/Coach/Account transition latency and unnecessary refetches;
- scroll and chart/map smoothness; use `gfxinfo` and note dropped frames;
- Compose recomposition/list/map memory behavior for native;
- WebView payload, layout shift, keyboard response, and offline fallback for Capacitor;
- GPS/background recording battery behavior, network retries, cancellation, and force-stop restore;
- no ANR, crash, unbounded history/route fetch, UI-thread blocking, or infinite retry loop.

Report device, API level, build type, network, test duration, and measurement method. Treat the
repository thresholds as warnings unless a stricter release gate applies.

## Fix or document every gap

After evidence is collected:

1. Fix confirmed P0/P1 defects that are clearly within this feature scope, preserving the approved
   design and shared behavior. Add or update focused tests where possible.
2. Fix P2/P3 issues when the change is small and low risk; otherwise plan them.
3. For every unresolved issue, update the relevant gate or evidence row in `EXECUTION_PLAN.md` with:
   - stable issue ID;
   - severity and affected app/client;
   - exact reproduction and evidence file/device/state;
   - expected behavior/reference;
   - proposed implementation and backend/API implications;
   - privacy/security/accessibility/performance impact;
   - acceptance test and owner/decision needed.
4. If native and Capacitor require different implementation details, keep the API/domain contract
   shared and document the client-specific work under the existing native gates (`NATIVE-001`–
   `NATIVE-008`). Do not hide a missing feature behind a visually complete screen.
5. Re-run focused tests, lint/typecheck/build, and the affected emulator flow after fixes. Do not
   claim parity from compilation alone.

## Final deliverable from the session

Return a strict review, not a vague summary, containing:

- exact commit/branch and both app build identifiers;
- emulator model/API, locale, theme, network, permissions, and test account type;
- the comparison matrix above;
- ordered findings (`P0`–`P3`) with reproduction and acceptance criteria;
- what was fixed, with files/tests;
- what remains open and where it was recorded in `EXECUTION_PLAN.md`;
- Coach context parity result and privacy result;
- performance measurements and untested areas;
- final status: `PASS`, `PASS WITH OPEN P2/P3`, or `BLOCKED`.

Do not approve the work if any P0/P1 remains, if either app skipped the run save/reopen flow, if the
Coach analyzed different or incomplete context, or if any required theme/locale/client comparison
was skipped.

---

Begin by stating the exact test matrix and the two app package IDs, then execute the checks.
