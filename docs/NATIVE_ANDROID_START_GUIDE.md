# Start the native Android app locally

This guide starts the isolated native Android evaluation app in `native-android/` on an emulator.
For the Capacitor app, use [`MOBILE_ANDROID.md`](MOBILE_ANDROID.md).

Native debug configuration:

- Package: `dz.racedz.nativeapp.debug`
- API: `http://10.0.2.2:3003/` (`10.0.2.2` is the emulator alias for the host machine)
- AVD used for local testing: `Pixel_8`
- Project: `native-android/`

## Prerequisites

Install Android Studio with the SDK, platform tools, emulator, and a supported JDK. Verify:

```bash
adb --version
emulator -list-avds
java -version
node --version
```

Install web dependencies once from the repository root:

```bash
npm install
```

## 1. Start the local server

In a terminal at the repository root:

```bash
npm run dev:lan
```

The server must listen on port `3003`. If it is already running, do not start a second instance.
Check it from the host:

```bash
curl -I http://127.0.0.1:3003
```

Do not copy `.env` values into Android resources or add a runtime server URL field to the app.

## 2. Start an emulator

```bash
emulator -list-avds
emulator -avd Pixel_8 -no-snapshot -no-boot-anim
```

In another terminal, wait for Android to finish booting:

```bash
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do
  sleep 2
done
adb devices
```

The device should appear as `emulator-5554 device`. If multiple devices are connected, target one
explicitly:

```bash
export ANDROID_SERIAL=emulator-5554
```

## 3. Build and install

From `native-android/`:

```bash
./gradlew :app:installDebug
```

Optional checks:

```bash
./gradlew :app:lintDebug testDebugUnitTest
```

The debug build uses package `dz.racedz.nativeapp.debug` and the local API shown above.

## 4. Launch

```bash
adb shell am force-stop dz.racedz.nativeapp.debug
adb shell monkey -p dz.racedz.nativeapp.debug -c android.intent.category.LAUNCHER 1
```

You can also open **ZidRun Native (Debug)** from the emulator launcher. Confirm the activity:

```bash
adb shell dumpsys activity activities | rg -m1 "mResumedActivity|mFocusedApp"
```

If the app stays on `Loading…`, check the server, emulator network, and API URL before changing
code.

## 5. Sign in and reset local app state

Use an isolated documented demo/test account. Do not use the owner’s personal account or real private
activity. The native app shares the local server/database with the web app.

To clear only the emulator’s native session and local app data:

```bash
adb shell pm clear dz.racedz.nativeapp.debug
adb shell monkey -p dz.racedz.nativeapp.debug -c android.intent.category.LAUNCHER 1
```

This does not delete server-side runs or account data.

## 6. Navigate and capture diagnostics

On the 320×640 emulator, the bottom navigation is approximately:

```bash
# Races, Runs, Coach, Account
adb shell input tap 40 605
adb shell input tap 120 605
adb shell input tap 200 605
adb shell input tap 280 605
```

Capture evidence outside Git:

```bash
adb exec-out screencap -p > /tmp/zidrun-native-screen.png
```

Capture app logs after reproducing an issue:

```bash
adb logcat -c
adb logcat -d -t 500 | rg -i "AndroidRuntime|FATAL EXCEPTION|ANR|nativeapp.debug|Exception|error"
```

Check rendering and memory:

```bash
adb shell dumpsys gfxinfo dz.racedz.nativeapp.debug \
  | rg "Janky frames|90th percentile|95th percentile|99th percentile|Number Missed Vsync"
adb shell dumpsys meminfo dz.racedz.nativeapp.debug | rg "TOTAL PSS|TOTAL RSS"
```

## 7. Run-recording permissions

Test location/background-activity rationale, denial, retry, and granted states on an isolated
emulator:

```bash
adb shell dumpsys package dz.racedz.nativeapp.debug \
  | rg "ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|POST_NOTIFICATIONS|granted=true"
```

For the full run, animation, save/reopen, Coach, theme, locale, RTL, privacy, and performance
acceptance flow, use [`CAPACITOR_NATIVE_PARITY_REVIEW_PROMPT.md`](CAPACITOR_NATIVE_PARITY_REVIEW_PROMPT.md).

## 8. Rebuild or stop

After native source changes:

```bash
cd native-android
./gradlew :app:installDebug
adb shell am force-stop dz.racedz.nativeapp.debug
adb shell monkey -p dz.racedz.nativeapp.debug -c android.intent.category.LAUNCHER 1
```

Stop only the app:

```bash
adb shell am force-stop dz.racedz.nativeapp.debug
```

Do not use the `internal` variant for ordinary emulator testing: it targets production and uses the
separate package `dz.racedz.nativeapp.internal`. Native release and parity requirements are in
[`NATIVE_ANDROID_OPTION_PLAN.md`](NATIVE_ANDROID_OPTION_PLAN.md) and
[`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md).
