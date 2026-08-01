# Native Android review — `a68a2c4`

> **Superseded — evidence only, not a tracker.**
> Triaged on 2026-08-01. Four findings were fixed the same day; three were already tracked as
> `NATIVE-005`, `SEC-006`, and `NATIVE-007`; the rest are carried in
> [`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md) as `NATPAR-001`–`NATPAR-007`. The `NATIVE-REV-*`
> numbering below is retired — `EXECUTION_PLAN.md` is the single tracker, and open actions must not
> live in two places. Kept as the dated record of what was reviewed and how.


Date: 2026-08-01  
Branch: `native-coach-parity`  
Commit reviewed: `a68a2c4` (`feat(native): Coach parity with Capacitor — nine defects fixed`)  
Reviewer scope: committed native Android code, emulator behavior, Capacitor comparison, security, UI/UX, and performance.

## Verdict

**Not ready for native acceptance or a release decision.**

The committed revision is buildable and the Coach API contract tests are strong, but several native
flows still diverge from the Capacitor product. The most important blockers are the broken Account
Support route, misleading Runs actions for manual/GPX flows, and the lack of physical-device GPS and
background-recovery evidence. The native release variant is also still explicitly an internal,
debug-keystore artifact without minification.

This review is read-only. No fixes were implemented.

## Scope and evidence

### Code and repository state

- Exact clean archive of `a68a2c4` passed:
  `./gradlew lintDebug testDebugUnitTest :app:assembleDebug`.
- `npm run check:native-i18n` passed with 461 keys consistent across English, French, and Arabic.
- `npm run test:coach-mobile` passed with 124 checks and 0 failures, including the eight profile
  cases and cross-user authorization checks.
- The worktree is dirty and contains six unstaged native source/resource edits plus four untracked
  PNG assets and two untracked guide/prompt files. Those changes are not included in this commit
  review and must be reviewed separately before merging.
- The Gradle build emits the known warning that AGP 8.7.3 was tested only through compileSdk 35
  while this project compiles against SDK 36.

### Emulator checks

Device: Pixel_8 AVD, package `dz.racedz.nativeapp.debug`, 320×640 emulator viewport.

Verified on the emulator:

- Native Runs overview in light, dark, and race modes.
- Per-app Arabic locale with RTL layout; the app rendered Algerian-Darija strings and mirrored
  navigation correctly.
- Account → Profile & preferences → theme controls.
- Start-run hold interaction, haptics/visual progress as shipped in the commit, recording screen,
  finish confirmation, and run summary.
- Account → Support reproduction described below.

Not available in this environment:

- A physical device with real GPS movement, background location, Doze, reboot, battery, or low-
  storage behavior.
- A second emulator for simultaneous Capacitor/native comparison.
- Full visual verification of every screen in all three themes, all three locales, large font scale,
  TalkBack, keyboard focus, offline, expired session, permission denial, and account switching.

Capacitor launched to its Runs overview, but the emulator log also showed Chrome/WebView renderer
crashes and low-memory kills. That is recorded as an emulator-environment limitation, not attributed
to Capacitor application code without a clean repeat.

## Findings

### P1 — release-blocking findings

#### NATIVE-REV-001 — Account Support opens Privacy & data

**Reproduction:** Open native Account, scroll to Support, tap it. The destination is titled
“Privacy & data” and shows privacy toggles, signed-in devices, and account deletion.

**Evidence:** `native-android/app/src/main/java/dz/racedz/nativeapp/ui/shell/AppShell.kt:172-180`
passes `onOpenPrivacy` as `onOpenSupport`. The only registered top-level Account routes are
Registrations, Profile, and Privacy in `native-android/app/src/main/java/dz/racedz/nativeapp/navigation/Destinations.kt:12-18`.

**Impact:** Users cannot reach support, and a support tap unexpectedly exposes a destructive/privacy
management surface. This is both a broken flow and a trust problem.

**Acceptance condition:** Add a distinct support destination or an intentional web support route;
verify back navigation, loading/error states, authentication, EN/FR/AR, RTL, and all three themes.
Add a UI test that Support and Privacy resolve to different destinations.

#### NATIVE-REV-002 — Manual entry and GPX import are visible but do not perform their actions

**Evidence:** `AppShell.kt:147-151` wires both `onLogManually` and `onImportGpx` to
`onOpenRunHistory`, with comments explicitly saying the features are still to come. The Capacitor
Runs experience has a manual recorder/log form and `GpxImport` in
`src/components/coach/runs-view.tsx:10,138-140`.

**Impact:** The native Runs page presents three actions as peers, but two open history instead of
doing what their labels promise. This is a high-confidence parity and UX defect.

**Acceptance condition:** Implement a native manual-entry form and file-picker GPX import with
validation, private storage, duplicate/idempotency behavior, progress, cancellation, errors, and
localized success states. Implement GPX export/share from Run Details. Test malformed, oversized,
empty, offline, and cross-account files.

#### NATIVE-REV-003 — Core GPS correctness is still unverified

**Observed:** On the emulator, a run entered Recording but stayed at `0.00 km` with GPS status
“Searching”; the finish/summary path could not produce a valid saved run for list/detail/Coach
verification.

**Repository evidence:** `docs/NATIVE_ANDROID_OPTION_PLAN.md:214-218` records that emulator fixes
report `speed = 0`, the speed filter therefore rejects movement, and GPS distance has never been
verified. The same document calls physical-device GPS the highest-value outstanding test.

**Impact:** The most important native feature—recording and saving a real run—has no acceptance
evidence. It also prevents confirming the post-save list refresh, Run Details charts, and Coach
analysis context with real data.

**Acceptance condition:** On at least two physical Android devices, verify stationary start,
movement, GPS cold start, city transition, pause/resume, screen-off/background recording, permission
changes, force-stop, offline save, retry, duplicate sync, and the saved run appearing immediately in
history without refresh. Capture distance/route/pace evidence and battery measurements.

#### NATIVE-REV-004 — Native Account feature coverage is substantially behind Capacitor

**Capacitor baseline:** `src/app/account/account-hub.tsx:89-115` exposes Feed, Groups, Leaderboards,
Registrations, Profile, Security, Notifications, Support, FAQ, notification settings, Coach,
human-Coach messages, Nutrition, Coach subscription, and workspace destinations.

**Native evidence:** `AccountScreen.kt:268-300` exposes only Registrations, Profile & preferences,
Privacy & data, Support, and Sign out. Native destinations do not currently include Security,
Notifications, FAQ, Feed, Groups, Leaderboards, Nutrition, human-Coach messages, or a native support
route.

**Impact:** A native-only user loses account security/notification controls and several product
features available in Capacitor. Some exclusions may be intentional web-first scope, but they are not
clearly marked in the native UI or acceptance matrix.

**Acceptance condition:** Create an explicit parity decision for every omitted surface. Implement the
required runner-facing surfaces or mark them intentionally web-only with a clear, working handoff.
Do not call native Coach/Account parity complete while required destinations are absent.

#### NATIVE-REV-005 — Internal build is not a release-safe artifact

**Evidence:** `native-android/app/build.gradle.kts:25-59` sets release and internal builds to
`isMinifyEnabled = false`; the `internal` variant uses the debug signing key and talks to production.
The file correctly documents that this is intentional and not Play-uploadable, but that means it is
not a release candidate.

**Impact:** A non-minified APK signed with a debug key is unsuitable for production user data,
store distribution, upgrade testing, or meaningful release security verification. It increases
reverse-engineering and accidental-distribution risk.

**Acceptance condition:** Produce a separate signed internal-track candidate with real release
identity, Play App Signing/asset-links evidence, minification/resource shrinking, mapping-file
handling, crash reporting, and a clean debug/internal separation. Never put a production keystore in
the repository.

#### NATIVE-REV-006 — Backend rate limiting is process-local unless the deployment guarantee is enforced

**Evidence:** `src/lib/rate-limit.ts:4-7` uses an in-memory fixed-window map and explicitly requires
a shared store such as Redis for multi-instance deployments. The current implementation is defense in
depth and depends on trusted edge limits in production.

**Impact:** With multiple Next.js instances, an attacker can distribute requests across instances and
evade per-process limits. This affects mobile auth, Coach generation, uploads, and other abuse-prone
routes.

**Acceptance condition:** Either enforce and document a single-instance deployment with tested edge
limits, or move security-critical limits to a shared store. Run the attack-test plan against the
actual topology and verify 401/403/429 behavior across instances.

### P2 — important parity, privacy, reliability, and performance gaps

#### NATIVE-REV-007 — Coach voice, memory/privacy controls, and goal editing are missing

**Evidence:** `docs/NATIVE_ANDROID_OPTION_PLAN.md:235-236` explicitly lists all three as missing.
Capacitor has microphone/transcription in `src/components/coach/coach-conversation.tsx`, memory
controls in `src/components/coach/coach-memory-panel.tsx`, and a prefilled edit flow in
`src/components/coach/coach-goal-form.tsx:30-40`. Native Coach currently exposes onboarding, plan,
conversation, and sleep, but no equivalent memory screen or voice/TTS path.

**Impact:** Native users cannot use the same accessible conversation mode, inspect/delete Coach
memory, or correct goal/language/health context after onboarding. This is especially important for
Arabic users and privacy trust.

**Acceptance condition:** Add versioned `/api/v1` contracts with ownership tests, then implement
permission-denial, recording/transcribing, TTS failure, memory provenance/forget/export/delete, and
goal-edit states in all themes/locales.

#### NATIVE-REV-008 — In-progress recording recovery is incomplete

**Evidence:** `docs/NATIVE_ANDROID_OPTION_PLAN.md:210-212` states WorkManager retry and reboot/Doze
recovery are missing. `RunTrackingService.kt:48-60` returns `START_STICKY`, but a sticky service alone
does not restore a trustworthy in-progress recording after process/device lifecycle events.

**Impact:** A service restart can leave the user with an ambiguous session, missing route points, or
an outbox state that cannot honestly resume. Finished-run salvage exists; full lifecycle recovery does
not.

**Acceptance condition:** Define explicit state transitions for pause, process death, reboot, Doze,
permission revocation, and force-stop. Use WorkManager for retry/sync, surface a recover/discard choice,
and prove behavior on physical devices.

#### NATIVE-REV-009 — Pending route data is JSON, not encrypted at rest

**Evidence:** `RunOutbox.kt:22-24,42-55` stores the full pending run, including route data, in
`filesDir/pending-run.json`. App-private storage, file-based encryption, `allowBackup=false`, and
atomic replacement are good controls, but the JSON is not additionally encrypted or Keystore-wrapped.

**Impact:** This is protected against ordinary other-app access, but a rooted/debugged device or
forensic extraction can expose location history. The native plan’s “encrypted/minimized local data”
goal is not fully met.

**Acceptance condition:** Encrypt sensitive outbox contents with a Keystore-backed key, purge on
successful sync, discard, logout, account switch, and deletion request, and test recovery when the key
is invalidated. Keep route size bounded and avoid storing unnecessary personal fields.

#### NATIVE-REV-010 — Foreground notification is rebuilt and posted every second

**Evidence:** `RunTrackingService.kt:92-101` calls `buildNotification()` and `notify()` every second.
`buildNotification()` also creates/checks the notification channel and constructs a new PendingIntent
path (`:138-175`).

**Impact:** This creates avoidable CPU, allocation, notification-manager, and battery work during the
longest-running native flow. It may also create unnecessary UI churn for accessibility services and
OEM notification surfaces.

**Acceptance condition:** Separate the one-time foreground notification from periodic content updates;
update at a measured cadence or only when meaningful metrics change. Profile battery, CPU, wakeups,
and notification behavior on low-end Android devices during a 60-minute run.

#### NATIVE-REV-011 — Account exposes the full email on the default screen

**Evidence:** `AccountScreen.kt:303-309` renders `account_signed_in_as` with `user.email`. The
approved Account design emphasizes display name and broad location and does not require the email to
be visible in the default hub.

**Impact:** Email is unnecessary shoulder-surfing and screenshot exposure. It conflicts with the
project goal of minimizing owner/user data exposure and with the privacy-safe design direction.

**Acceptance condition:** Remove or mask email from the default Account surface; reveal it only in a
deliberate security/profile context. Verify screenshots, accessibility labels, all themes, and RTL.

#### NATIVE-REV-012 — HTTPS race links are not auto-verified

**Evidence:** `AndroidManifest.xml:74-92` intentionally omits `android:autoVerify="true"` because the
Capacitor package currently owns the domain. This is documented, but native HTTPS links therefore do
not have a seamless verified-owner experience; custom `zidrun://` links remain claimable by other apps.

**Impact:** Native users may see a chooser/browser instead of the expected detail screen. Custom-scheme
interception remains a security surface even though PKCE protects the OAuth code exchange.

**Acceptance condition:** After the native decision, publish matching `assetlinks.json`, enable
`autoVerify`, test malicious/custom-scheme interception, validate state/PKCE binding, and verify safe
fallback behavior for unknown or expired links.

#### NATIVE-REV-013 — Full three-mode/three-locale/accessibility parity is not yet evidenced

**Evidence:** Automated string parity passed, and Arabic RTL was manually opened successfully. The
review did not obtain complete evidence for every native screen in light/dark/race, French visual
copy, large font scale, TalkBack, keyboard focus, permission denial, offline, expired session, or
network error states. The native plan itself lists these as required checks at
`docs/NATIVE_ANDROID_OPTION_PLAN.md:527-542`.

**Impact:** Key regressions can remain hidden even while the build and key-contract tests pass. This
is particularly risky for dense run charts, Arabic text expansion, one-handed controls, and Coach
onboarding forms.

**Acceptance condition:** Run a screen/state matrix for Races, Runs, Coach, Account, registration,
auth, and all subpages in EN/FR/Algerian Darija, all three themes, RTL, TalkBack, 200% font scale,
keyboard, offline, loading, empty, error, permission, and back-navigation states. Attach screenshots
or test evidence to the release gate.

#### NATIVE-REV-014 — Native acceptance documentation overstates Coach verification

**Evidence:** `docs/NATIVE_ANDROID_OPTION_PLAN.md:220-236` labels Phase 8 “verified on an emulator
against the Capacitor baseline” while the same section lists missing voice/TTS, memory/privacy, and
goal editing. The commit also leaves the Account Support defect and Runs action gaps described above.

**Impact:** The wording can cause reviewers to treat a partial vertical slice as complete parity.

**Acceptance condition:** Change status language to “partial parity verified,” list exact tested
screens/states, link the review report, and keep missing P1/P2 items open until their evidence exists.

## Controls that were verified positively

- Native session tokens use `EncryptedSharedPreferences` with an Android Keystore-backed AES key in
  `native-android/core/auth/.../TokenStore.kt:19-55`.
- The network client sends no logging interceptor, adds request IDs, limits transparent refresh to
  one replay, and avoids retrying arbitrary writes (`ApiClient.kt:49-80,211-219`).
- Server mobile auth checks token validity, user existence/block state, security stamp, and active
  mobile session on every request (`src/lib/api/v1/guard.ts:17-84`).
- Native API contract tests covered profile variations, safety fields, reply shape, and runner
  isolation; all 124 checks passed.
- Manifest backup is disabled, the tracking service is not exported, and cleartext HTTP is refused by
  the production network-security config. Debug cleartext access is intentionally scoped to the local
  emulator host.
- The run outbox uses app-private storage and atomic temporary-file replacement, so ordinary partial
  writes do not leave a corrupt pending run.
- The Arabic resource file is explicitly written in Algerian Darija, and the emulator showed RTL
  layout rather than merely changing strings.

## Required next sequence

1. Fix and test Support routing; decide and document every Account/Coach feature that is native or
   intentionally web-only.
2. Implement manual run and GPX import/export, then test a valid real-GPS save and immediate list,
   detail, and Coach-analysis refresh.
3. Run physical-device lifecycle/GPS/battery tests, including offline and recovery cases.
4. Harden the release artifact and deployment rate limiting; run the repository security attack-test
   plan against the actual native/backend candidate.
5. Complete the visual/accessibility matrix in all three modes and languages, including Arabic RTL,
   then update the native decision gate with evidence rather than prose-only status.

Until steps 1–4 have evidence, keep Capacitor as the release path and keep the native app in isolated
evaluation status.
