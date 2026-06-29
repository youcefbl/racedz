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
    if (!token) return;
    const callbackUrl = safeInternalPath(url.searchParams.get("callbackUrl")) ?? "/account";
    // Dismiss the system browser that ran the Google OAuth, if it's still open.
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
    } catch {
      /* browser already closed / plugin missing — fine */
    }
    try {
      await signIn("native-bridge", { token, redirect: false });
    } catch {
      /* fall through to navigation; the session check on the page will gate access */
    }
    window.location.assign(callbackUrl);
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
