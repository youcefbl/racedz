# Running the native app on a real phone over Wi-Fi (ADB wireless debugging)

Practical runbook for driving `native-android/` on a physical device **without a USB cable**,
against the local dev stack. Written from the working 2026-08-05 session on the Samsung
SM-M215G (Galaxy M21, Android 13); every command here was actually run.

Use this when USB is unavailable or misbehaving — in that session `adb` reported the phone as
`unauthorized` after it re-enumerated on the bus and would not re-prompt, and wireless pairing
was the fastest way around it. See also `docs/TESTING.md` and the USB recipe in
`docs/MOBILE_ANDROID.md`.

## Requirements

- Android 11+ on the phone (wireless debugging is a platform feature; One UI keeps it).
  Confirm with `adb shell getprop ro.build.version.release` once connected.
- Phone and PC on the **same Wi-Fi network**.
- `platform-tools` on PATH:
  ```bash
  export PATH=$HOME/zidrun-toolchain/android-sdk/platform-tools:$PATH
  ```

**Why this also dodges the firewall:** the host runs `ufw` with `DEFAULT_INPUT_POLICY="DROP"`, so
the phone cannot reach the dev server on the LAN. It does not need to — the connection is
*outbound* from the PC to the phone, and `adb reverse` still tunnels `localhost:3003` to the phone
through the adb link. No firewall change is needed.

## One-time pairing

On the phone: **Settings → Developer options → Wireless debugging** → ON, then tap
**"Pair device with pairing code"** and leave that dialog open — it shows a 6-digit code.

Both the pairing port and the connect port are randomized and **change every time the screen or
dialog is reopened**, so discover them instead of typing them:

```bash
adb mdns services
# adb-RZ8T10W90CL-LonxX0  _adb-tls-pairing._tcp  192.168.100.28:39397   <- pairing dialog
# adb-RZ8T10W90CL-LonxX0  _adb-tls-connect._tcp  192.168.100.28:42279   <- the daemon
```

Pair with the **`_adb-tls-pairing`** address and the code from the dialog, then connect to the
**`_adb-tls-connect`** address:

```bash
adb pair 192.168.100.28:39397 491275
# Successfully paired to 192.168.100.28:39397 [guid=adb-RZ8T10W90CL-LonxX0]

adb connect 192.168.100.28:42279
# connected to 192.168.100.28:42279
```

Pairing persists across reboots; only the connect step is needed in later sessions.

## Every session

```bash
export PATH=$HOME/zidrun-toolchain/android-sdk/platform-tools:$PATH

# 1. Reconnect (ports change — rediscover rather than guessing)
adb mdns services
adb connect 192.168.100.28:<connect-port>

# 2. Pin the serial: the phone appears TWICE (raw IP + mDNS name), and every
#    unpinned adb call then fails with "more than one device/emulator".
export ANDROID_SERIAL=adb-RZ8T10W90CL-LonxX0._adb-tls-connect._tcp

# 3. Local stack
docker start racedz_postgres_dev
npm run dev                      # 127.0.0.1:3003

# 4. Tunnel the dev server into the phone — works over Wi-Fi exactly as over USB
adb reverse tcp:3003 tcp:3003

# 5. Build + install
cd native-android
JAVA_HOME=$HOME/zidrun-toolchain/jdk17 ./gradlew assembleDebug \
  -Pzidrun.debugApiBase=http://localhost:3003/
adb install -r -d app/build/outputs/apk/debug/app-debug.apk

adb shell am start -n dz.racedz.nativeapp.debug/dz.racedz.nativeapp.MainActivity
```

`localhost` is already allowed by the debug `network_security_config.xml` — do **not** relax it for
a LAN IP.

## Driving the app

```bash
PKG=dz.racedz.nativeapp.debug

# Screenshot
adb exec-out screencap -p > shot.png

# Read the real view hierarchy (also the only reliable way to get tap coordinates)
adb shell uiautomator dump /sdcard/ui.xml
adb exec-out cat /sdcard/ui.xml

# Theme: set User.theme in the local DB, then restart the app (it applies the
# server value at launch). Faster and more reliable than driving the settings UI.
adb shell am force-stop $PKG && adb shell am start -n $PKG/dz.racedz.nativeapp.MainActivity

# Locale (note: --locales, NOT --locale-tags, on this device)
adb shell cmd locale set-app-locales $PKG --locales ar
adb shell cmd locale set-app-locales $PKG --locales en

# Font scale (reset when done)
adb shell settings put system font_scale 1.3
adb shell settings put system font_scale 1.0

# Inspect the run outbox (per-account slots)
adb shell "run-as $PKG ls files/run-outbox/"
```

Unlocking after the screen sleeps:

```bash
adb shell input keyevent KEYCODE_WAKEUP
adb shell input swipe 540 1900 540 600 300
adb shell input text 'yourpassword'    # single quotes: "…\!" inserts a literal backslash
adb shell input keyevent 66
```

## Traps

- **Ports change.** Both the pairing and connect ports are new each time the Wireless debugging
  screen is reopened. `adb mdns services` is the source of truth; a stale port gives
  `Connection refused`, and a stale *IP* gives `No route to host`.
- **Two entries, one phone.** After `adb connect`, `adb devices` lists the raw IP *and* the mDNS
  name. Pin `ANDROID_SERIAL` or every call fails with `more than one device/emulator`.
- **Black screenshots** usually mean the screen slept (or a password field is on screen — ColorOS
  privacy). Wake and unlock, then re-shoot; don't debug the app for it.
- **Screenshots race the load.** Dump `uiautomator` first, or re-shoot once the expected text is
  present, otherwise you capture the "Loading…" state.
- **The bottom tab bar mirrors in RTL.** Fixed tap coordinates hit the wrong tab in Arabic —
  re-derive them from a dump, or mirror x. On this panel the tab row is at y ≈ 2130.
- **Wi-Fi latency is real** (~70 ms ping here). Installs and `exec-out` transfers are slower than
  USB; give `sleep` steps a little more room in scripted passes.
- **`adb reverse` dies with the connection.** After any reconnect, re-run it or the app shows
  "Check your connection and try again." while the dev server logs nothing.
- The `racedz_postgres_dev` container stops on its own — `docker start` it before a session, and
  restart `npm run dev` after any `prisma generate`.
