"use client";

import { Capacitor } from "@capacitor/core";
import { signIn } from "next-auth/react";
import { useEffect } from "react";

// Handles inbound deep links in the native app (no-op on the website):
//  • Verified App Links  https://zidrun.com/<path>  -> navigate inside the webview.
//  • Native Google OAuth return  zidrun://auth?token=XXX  -> exchange the one-time
//    token for a real session via the "native-bridge" credentials provider, then
//    land the user on their account. See src/app/auth/native/handoff/route.ts.
export function NativeDeepLinks() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let remove: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appUrlOpen", ({ url }) => {
          void handleDeepLink(url);
        });
        remove = () => void handle.remove();
      } catch {
        /* @capacitor/app unavailable — fine */
      }
    })();

    return () => remove?.();
  }, []);

  return null;
}

// The handoff page can dispatch the zidrun://auth link more than once (meta refresh +
// script), so the OS may deliver appUrlOpen twice. Exchange each one-time token only once.
let lastHandledToken: string | null = null;

async function handleDeepLink(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }

  // Native Google OAuth callback: zidrun://auth?token=<one-time>&callbackUrl=<path>
  if (url.protocol === "zidrun:" && url.host === "auth") {
    const token = url.searchParams.get("token");
    if (!token || token === lastHandledToken) return;
    lastHandledToken = token;
    const callbackUrl = safeInternalPath(url.searchParams.get("callbackUrl")) ?? "/account";
    // Dismiss the system browser that ran the Google OAuth, if it's still open.
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
    } catch {
      /* browser already closed / plugin missing — fine */
    }
    // Exchange the one-time token for a WebView session. signIn(redirect:false) does NOT
    // throw when the token is invalid/expired/used — it returns { ok:false } — so check the
    // result and only land on the destination when a session was actually created. Otherwise
    // go back to login with a flag (navigating to /account with no session silently bounces).
    let ok = false;
    try {
      const result = await signIn("native-bridge", { token, redirect: false });
      ok = Boolean(result && !result.error);
    } catch {
      ok = false;
    }
    window.location.assign(ok ? callbackUrl : "/login?native=1&authError=1");
    return;
  }

  // Verified App Link to the site itself: open the same-origin path in the webview.
  if (url.protocol === "https:" && (url.host === "zidrun.com" || url.host === "www.zidrun.com")) {
    const target = `${url.pathname}${url.search}${url.hash}` || "/";
    window.location.assign(target);
  }
}

function safeInternalPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
