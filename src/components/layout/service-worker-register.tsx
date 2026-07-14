"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

// Registers the right service worker per platform:
// - Website: the Firebase-messaging worker (push). It doesn't cache pages/assets — see
//   public/firebase-messaging-sw.js — and this handles prompt takeover + one reload on update.
// - Native app: a cache-only worker for hashed /_next/static assets (public/native-asset-sw.js)
//   so warm starts load JS/CSS from disk. Native uses FCM push directly, so no firebase SW there.

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

    // Native: register the cache-only asset worker. Registering it at scope `/` also replaces any
    // SW a previous build left controlling the WebView (e.g. the old caching one that looped), and
    // that worker's `activate` nukes every legacy cache. Crucially there is NO controllerchange
    // reload in this branch — that was the source of the past WebView reload loops.
    if (Capacitor.isNativePlatform()) {
      const registerAssetWorker = () => navigator.serviceWorker.register("/native-asset-sw.js").catch(() => undefined);
      if (document.readyState === "complete") {
        registerAssetWorker();
      } else {
        window.addEventListener("load", registerAssetWorker, { once: true });
      }
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
