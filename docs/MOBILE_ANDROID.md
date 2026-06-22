# RaceDZ Android app (Capacitor) — Ubuntu testing guide

RaceDZ ships as a **Capacitor** native shell that loads the live web app in a webview.
There is no static export — the app talks to a running RaceDZ server (your local `npm run dev`
for testing, or the hosted domain for release). This keeps server components, server actions,
and auth working exactly like the website.

- App id: `dz.racedz.app` · Name: **RaceDZ**
- Config: [`capacitor.config.ts`](../capacitor.config.ts) (server-URL model)
- Native project: `android/` (build artifacts gitignored)

---

## 0. One-time machine setup (Ubuntu)

You currently have **no Java / Android SDK / Android Studio**. KVM is available, so the
emulator will be hardware-accelerated.

### Install Android Studio (recommended — bundles JDK + SDK + emulator)

```bash
sudo snap install android-studio --classic
```

(Or download the tarball from https://developer.android.com/studio and run `bin/studio.sh`.)

Launch it once and complete the **Setup Wizard** (Standard install). It downloads the
Android SDK, platform tools, build tools, and an emulator system image. Then:

- **More Actions → SDK Manager** → confirm **Android 14 (API 34)** SDK Platform + **Android SDK
  Build-Tools** + **Android SDK Command-line Tools** are installed.

### Make the SDK tools visible to the terminal

Add to `~/.bashrc` (Studio installs the SDK at `~/Android/Sdk` by default):

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
# Java bundled with Android Studio (snap path shown; adjust if you used the tarball):
export JAVA_HOME="/snap/android-studio/current/jbr"
export PATH="$PATH:$JAVA_HOME/bin"
```

Then `source ~/.bashrc` and verify:

```bash
java -version     # should print a version (17+)
adb --version     # should print a version
```

> Node note: you're on Node 18, so this project pins **Capacitor 6**. If you upgrade to
> **Node 22 LTS** later, you can move to Capacitor latest (`npm i @capacitor/core@latest
> @capacitor/cli@latest @capacitor/android@latest` then `npx cap sync`).

---

## 1. Point the app at your dev server

The webview loads whatever URL is in the Capacitor config. For local testing, override it
with `CAP_SERVER_URL` and re-sync. **Pick the address that matches how the device reaches your PC:**

| Target | Address to use | Why |
|---|---|---|
| Emulator | `http://10.0.2.2:3003` | `10.0.2.2` is the emulator's alias for your PC's loopback |
| Physical phone (USB) | `http://localhost:3003` + `adb reverse` | tunnel device→PC over USB |
| Physical phone (Wi-Fi) | `http://<your-PC-LAN-IP>:3003` | same network |

Start the dev server so it accepts connections from the device (binds all interfaces):

```bash
npm run dev:lan       # next dev on 0.0.0.0:3003
```

> ⚠️ **Login caveat.** Auth.js is configured for the `127.0.0.1:3003` origin. Plain browsing
> (races, details, language, theme) works at any address. For **login to work in the app**, the
> server's auth/base URL must match the URL the webview loads. Easiest fix while testing: set
> your `.env` `NEXTAUTH_URL` / app URL to the same address you put in `CAP_SERVER_URL`
> (e.g. `http://10.0.2.2:3003`), restart `dev:lan`, then sync. For release this is a non-issue —
> the app and auth both use the real `https://racedz.dz` domain.

Sync the chosen URL into the native project (sets cleartext-http automatically because the URL is `http://`):

```bash
CAP_SERVER_URL=http://10.0.2.2:3003 npm run cap:sync
```

---

## 2A. Run on an emulator (simplest)

Create a virtual device once: Android Studio → **Device Manager → Create Device** → pick e.g.
Pixel 7, choose the API 34 image → Finish.

Then either:

```bash
npm run cap:open        # opens Android Studio → press the green ▶ Run
# or, fully from the CLI:
npm run android:run     # builds, picks a running emulator/device, installs, launches
```

First Gradle build downloads dependencies (a few minutes). Subsequent runs are fast.

## 2B. Run on a physical phone (USB)

1. On the phone: **Settings → About phone →** tap **Build number** 7× to enable Developer
   options, then **Developer options → USB debugging = on**.
2. Plug in, accept the "Allow USB debugging" prompt, then:
   ```bash
   adb devices                       # your phone should be listed
   adb reverse tcp:3003 tcp:3003     # phone's localhost:3003 -> your PC:3003
   CAP_SERVER_URL=http://localhost:3003 npm run cap:sync
   npm run android:run
   ```

---

## 3. Day-to-day workflow

- **Changed web code (pages, UI, server actions):** just reload the app — it loads live from
  your dev server. No rebuild needed. (Pull-to-refresh or relaunch.)
- **Changed `capacitor.config.ts`, icons, native config, or `CAP_SERVER_URL`:** re-run
  `npm run cap:sync`, then rebuild/run.
- **App icon / splash:** icons come from `public/icon-*.png` (regenerate with `npm run icons:gen`).

---

## 4. What to verify in the app

- Home, races list, race detail, language switch (EN/FR/AR + RTL), theme switch.
- Login + a server action (e.g. register for a race) — watch for the auth-origin caveat above.
- The AI coach flow under `/account/coach`.
- Back-button behavior and scrolling/safe-area on a real device.

---

## 5. Release build (later)

For the Play Store you'll:
1. Set `CAP_SERVER_URL` to the production `https://` domain (or rely on the default in the config).
2. `npm run cap:sync`.
3. In Android Studio: **Build → Generate Signed Bundle / APK** (create a keystore, build an
   **.aab**), then upload to the Play Console (one-time $25 developer account).
4. Add native niceties before submission: splash screen, push (FCM/APNs), camera/photo picker
   for uploads, deep links. (These are Capacitor plugins — a follow-up task.)

iOS requires a Mac + Xcode (`npm i @capacitor/ios && npx cap add ios`) and an Apple Developer
account ($99/yr); it can't be built on Ubuntu.
