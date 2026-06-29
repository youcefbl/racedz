# ZidRun Android app (Capacitor) — Ubuntu testing guide

ZidRun ships as a **Capacitor** native shell that loads the live web app in a webview.
There is no static export — the app talks to a running ZidRun server (your local `npm run dev`
for testing, or the hosted domain for release). This keeps server components, server actions,
and auth working exactly like the website.

- App id: `dz.racedz.app` · Name: **ZidRun**
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

> ✅ **Login.** Email/password login works at **any** origin (emulator, LAN IP, prod):
> Auth.js runs with `trustHost: true` and the login action redirects to a relative path,
> so there's no hardcoded-origin bounce. No `.env` change needed for native testing.
>
> **Google sign-in** can't run inside a WebView (Google blocks embedded OAuth), so the
> app opens Google in the **system browser** and returns via the `zidrun://auth` deep link
> (see the Native features section below). This needs the real `https://zidrun.com` domain,
> so test it against production, not the local dev server.

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
- Login + a server action (e.g. register for a race).
- The AI coach flow under `/account/coach`.
- Back-button behavior and scrolling/safe-area on a real device.

---

## 5. Native features (splash, icons, deep links, Google OAuth, push)

These ship in the app shell. Some need a one-time external setup before they work in production.

### Splash screen & launcher icon — done, no setup

- Branded splash: dark `#0c1116` background + centered ZidRun wordmark/Z mark.
  - Regenerate with `node scripts/gen-splash.mjs` (writes `android/.../drawable-*/splash.png`).
  - Config: `SplashScreen` block in [`capacitor.config.ts`](../capacitor.config.ts); `NativeChrome`
    calls `SplashScreen.hide()` once the web app mounts.
- Launcher/adaptive icon: green/orange Z on dark. Regenerate with `node scripts/gen-android-icons.mjs`.
  (Android 12+ reuses the launcher foreground for its system splash, so these match.)

### Deep links / App Links — needs assetlinks hosted + release fingerprint

`https://zidrun.com/<path>` opens the app directly (verified App Links), and `zidrun://` is the
custom scheme used by the Google OAuth return. Handler: [`native-deep-links.tsx`](../src/components/layout/native-deep-links.tsx).

To make verified App Links work in production:
1. The file [`public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json) is served at
   `https://zidrun.com/.well-known/assetlinks.json`. It currently lists the **debug** signing-cert
   SHA-256 only.
2. Add your **release** keystore's SHA-256 to the `sha256_cert_fingerprints` array (get it with
   `keytool -list -v -keystore <release.keystore> -alias <alias>`). Without it, App Links won't
   verify for the Play Store build (links still open via the chooser; they just won't auto-open).

### Native Google sign-in — works once Google web OAuth is configured in prod

Flow: app → system browser at `https://zidrun.com/login?native=1&provider=google` → normal web
Google OAuth → `/auth/native/handoff` mints a one-time token → `zidrun://auth?token=…` deep link →
the app exchanges it via the `native-bridge` credentials provider for a real session.

- **No new Google Cloud redirect URI is needed** — OAuth happens at `zidrun.com` exactly like the
  website. Just ensure production has `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` set and the existing
  `https://zidrun.com/api/auth/callback/google` redirect URI registered.
- Backed by the `NativeAuthToken` model (5-min, single-use); see [`src/lib/native-auth.ts`](../src/lib/native-auth.ts).

### Push notifications — needs `google-services.json`

Native FCM device tokens are saved to the **same** backend as web push
(`POST /api/notifications/push-subscriptions`); registration lives in
[`native-push.tsx`](../src/components/layout/native-push.tsx). Until the Firebase config file is
present, registration silently no-ops (the app still builds and runs).

One-time setup (Firebase project `racedz-625ae` already exists):
1. Firebase console → Project settings → **Add app → Android**, package name **`dz.racedz.app`**.
2. Download **`google-services.json`** and place it at **`android/app/google-services.json`**
   (gitignored; the Gradle config auto-applies the google-services plugin when present).
3. `npm run cap:sync` and rebuild. Tokens then register for signed-in users and tapping a
   notification routes to its `data.href`.

---

## 6. Release build (later)

For the Play Store you'll:
1. Rely on the default production `https://zidrun.com` in the config (leave `CAP_SERVER_URL` unset).
2. `npm run cap:sync`.
3. In Android Studio: **Build → Generate Signed Bundle / APK** (create a keystore, build an
   **.aab**), then upload to the Play Console (one-time $25 developer account).
4. Add the release keystore SHA-256 to `assetlinks.json` (App Links) and drop in
   `google-services.json` (push) — see section 5.

> Quick debug APK (sideload on your own phone, no keystore):
> `cd android && ./gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`.

iOS requires a Mac + Xcode (`npm i @capacitor/ios && npx cap add ios`) and an Apple Developer
account ($99/yr); it can't be built on Ubuntu.
