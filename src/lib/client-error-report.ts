"use client";

import { Capacitor } from "@capacitor/core";

// Best-effort crash beacon: mirrors the analytics tracker's sendBeacon-with-fetch-fallback
// pattern, since this fires from error boundaries — the page may already be in a broken
// state, so this must never throw and never depend on anything that could itself fail.
export function reportClientError(input: { error: Error & { digest?: string }; route: string; boundary?: string }) {
  try {
    const payload = JSON.stringify({
      message: input.error.message?.slice(0, 2000) || "Unknown error",
      stack: input.error.stack?.slice(0, 8000),
      digest: input.error.digest,
      route: input.route,
      boundary: input.boundary,
      platform: Capacitor.isNativePlatform() ? "android" : "web"
    });

    const blob = new Blob([payload], { type: "application/json" });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/client-errors", blob)) {
      return;
    }

    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => {
      /* best-effort */
    });
  } catch {
    /* reporting the crash must never itself crash */
  }
}
