import type { CapacitorConfig } from "@capacitor/cli";

// RaceDZ is a server-rendered Next.js app (server components, server actions, auth),
// so the native shell loads the live web app in a webview instead of a static export.
//
// - Production: defaults to the hosted domain below.
// - Local testing: override with CAP_SERVER_URL, e.g.
//     Android emulator:  CAP_SERVER_URL=http://10.0.2.2:3003 npx cap sync android
//     Physical device:   CAP_SERVER_URL=http://<your-LAN-IP>:3003 npx cap sync android
//   then rebuild/run the app.
const serverUrl = process.env.CAP_SERVER_URL || "https://racedz.dz";
const isCleartext = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "dz.racedz.app",
  appName: "RaceDZ",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: isCleartext
  }
};

export default config;
