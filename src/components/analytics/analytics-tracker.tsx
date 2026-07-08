"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { readCookieConsent } from "@/lib/cookie-consent";
import { getLocale } from "@/lib/i18n";

// Fires one page-view beacon per route change (and per language switch) to
// /api/track. Covers every public and authenticated page because it's mounted in
// the root layout. Uses navigator.sendBeacon so the request survives navigation,
// with a keepalive fetch fallback. Path/query enrichment happens server-side.
export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lang = getLocale(searchParams.get("lang"));
  // Remembers the last recorded path|lang for this page load so we don't
  // double-count React re-renders or unrelated query-string changes (filters,
  // pagination) — the server normalizes those away anyway.
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    // Honor an explicit cookie rejection — skip analytics (no zr_vid/zr_sid then).
    if (readCookieConsent() === "rejected") return;

    const key = `${pathname}|${lang}`;
    if (lastKey.current === key) return;

    // document.referrer only carries a meaningful external source on the initial
    // full page load; on client-side navigations it's stale, so send it once.
    const isFirstOfLoad = lastKey.current === null;
    lastKey.current = key;

    const payload = JSON.stringify({
      path: pathname,
      locale: lang,
      referrer: isFirstOfLoad ? document.referrer || undefined : undefined,
      platform: Capacitor.isNativePlatform() ? "android" : "web"
    });

    try {
      const blob = new Blob([payload], { type: "application/json" });
      if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/track", blob)) {
        return;
      }
    } catch {
      /* fall through to fetch */
    }

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => {
      /* tracking is best-effort */
    });
  }, [pathname, lang]);

  return null;
}
