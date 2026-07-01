"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

// Registers the Firebase-messaging service worker (push notifications). The worker no
// longer caches pages/assets — see public/firebase-messaging-sw.js for why — so this is
// mostly about push, plus making sure a new worker version takes over promptly and the
// page reloads once when it does (so a deploy reaches already-open browsers).

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // The native app loads the remote site and uses native FCM push — a service worker
    // here only causes trouble (controllerchange -> window.location.reload(), which can
    // reload the WebView at bad moments and crash/loop it). Never register one in native,
    // and tear down any a previous build may have left controlling the WebView.
    if (Capacitor.isNativePlatform()) {
      navigator.serviceWorker
        .getRegistrations?.()
        .then((registrations) => registrations.forEach((registration) => void registration.unregister()))
        .catch(() => undefined);
      return;
    }

    let url = "/firebase-messaging-sw.js";
    if (Object.values(firebaseConfig).every(Boolean)) {
      const params = new URLSearchParams(firebaseConfig as Record<string, string>);
      url = `/firebase-messaging-sw.js?${params.toString()}`;
    }

    // Reload once when a NEW worker takes control (an update) — never on the first
    // registration, and guarded so it can't loop.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    const onControllerChange = () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = () =>
      navigator.serviceWorker
        .register(url)
        .then((registration) => {
          // Proactively check for a newer worker on each load so deploys propagate.
          registration.update().catch(() => undefined);
        })
        .catch(() => undefined);

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
