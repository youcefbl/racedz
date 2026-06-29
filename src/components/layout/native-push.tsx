"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

// Native push registration (no-op on the website). On Android the device token is
// an FCM registration token, so it flows through the SAME backend the web/PWA push
// uses: POST /api/notifications/push-subscriptions (see firebase-provider.ts).
//
// Requires android/app/google-services.json for the dz.racedz.app Android app under
// the existing Firebase project (racedz-625ae). Until that file is present,
// register() raises registrationError and this silently no-ops.
export function NativePush() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      // The push-subscriptions API requires an authenticated session, so only
      // register a token once the user is signed in.
      if (!(await isAuthenticated())) return;

      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const registration = await PushNotifications.addListener("registration", (token) => {
          void savePushToken(token.value);
        });
        const registrationError = await PushNotifications.addListener("registrationError", () => {
          /* usually means google-services.json is missing — ignore */
        });
        const tapped = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const href = action.notification?.data?.href;
          if (typeof href === "string" && href.startsWith("/")) {
            window.location.assign(href);
          }
        });

        const removeAll = () => {
          void registration.remove();
          void registrationError.remove();
          void tapped.remove();
        };
        cleanup = removeAll;

        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
          permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive !== "granted") {
          removeAll();
          cleanup = undefined;
          return;
        }

        await PushNotifications.register();
      } catch {
        /* plugin unavailable — fine */
      }
    })();

    return () => cleanup?.();
  }, []);

  return null;
}

async function isAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { headers: { accept: "application/json" } });
    const data = (await res.json().catch(() => null)) as { user?: { id?: string } } | null;
    return Boolean(data?.user?.id);
  } catch {
    return false;
  }
}

async function savePushToken(token: string): Promise<void> {
  try {
    await fetch("/api/notifications/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, deviceLabel: "Android app" })
    });
  } catch {
    /* offline / transient — the plugin re-fires registration on next launch */
  }
}
