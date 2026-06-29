import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

// ZidRun is a server-rendered Next.js app (server components, server actions, auth),
// so the native shell loads the live web app in a webview instead of a static export.
//
// - Production: defaults to the hosted domain below.
// - Local testing: override with CAP_SERVER_URL, e.g.
//     Android emulator:  CAP_SERVER_URL=http://10.0.2.2:3003 npx cap sync android
//     Physical device:   CAP_SERVER_URL=http://<your-LAN-IP>:3003 npx cap sync android
//   then rebuild/run the app.
const serverUrl = process.env.CAP_SERVER_URL || "https://zidrun.com";
const isCleartext = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "dz.racedz.app",
  appName: "ZidRun",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: isCleartext
  },
  plugins: {
    // Resize the webview body when the keyboard opens so focused inputs aren't covered,
    // and keep the OS accessory bar so users can dismiss the keyboard.
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true
    },
    // Branded launch screen: dark brand background (#0c1116) with the centered
    // ZidRun wordmark. NativeChrome calls SplashScreen.hide() as soon as the web
    // app has mounted; launchShowDuration is the safety cap if that never fires.
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#0c1116",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
