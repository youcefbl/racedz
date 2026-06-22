"use client";

import { useEffect } from "react";

// Registers the combined service worker (offline caching + Firebase messaging) on app load,
// so offline support is active for every visitor — not only those who enable push.
// When the public Firebase config is present, the same config-bearing URL the push flow uses
// is registered, so the two registrations are identical (idempotent) and never conflict.

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

    let url = "/firebase-messaging-sw.js";
    if (Object.values(firebaseConfig).every(Boolean)) {
      const params = new URLSearchParams(firebaseConfig as Record<string, string>);
      url = `/firebase-messaging-sw.js?${params.toString()}`;
    }

    const register = () => navigator.serviceWorker.register(url).catch(() => undefined);

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
