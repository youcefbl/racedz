"use client";

import { useEffect } from "react";
import { APPEARANCE_COOKIE_MAX_AGE, LOCALE_COOKIE, THEME_COOKIE } from "@/lib/appearance";

const SYNCED_FLAG = "racedz-appearance-synced";

// Adopts the signed-in runner's saved language/theme on a device that doesn't have them yet
// (e.g. their first login on a new phone). Runs at most once per browser to avoid re-fetching
// on every visit; local changes thereafter write straight back to the DB via saveAppearanceAction.
export function AppearanceSync() {
  useEffect(() => {
    try {
      if (localStorage.getItem(SYNCED_FLAG)) return;
    } catch {
      return;
    }

    void fetch("/api/me/appearance", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { data?: { language?: string | null; theme?: string | null } } | null) => {
        try {
          localStorage.setItem(SYNCED_FLAG, "1");
        } catch {
          /* storage blocked — best effort */
        }
        const data = payload?.data;
        if (!data) return;

        const hasLocalTheme = safeGet(THEME_COOKIE) !== null || safeLocalTheme() !== null;
        if (data.theme && !hasLocalTheme) {
          document.documentElement.dataset.theme = data.theme;
          try {
            localStorage.setItem("racedz-theme", data.theme);
          } catch {
            /* ignore */
          }
          setCookie(THEME_COOKIE, data.theme);
        }

        if (data.language && safeGet(LOCALE_COOKIE) === null) {
          setCookie(LOCALE_COOKIE, data.language);
          const currentLang = new URLSearchParams(window.location.search).get("lang") ?? "en";
          // Re-render in the saved language only when the page isn't already showing it.
          if (data.language !== "en" && currentLang !== data.language) {
            const url = new URL(window.location.href);
            url.searchParams.set("lang", data.language);
            window.location.replace(url.toString());
          }
        }
      })
      .catch(() => {
        /* offline / transient — try again next browser session */
      });
  }, []);

  return null;
}

function safeLocalTheme() {
  try {
    return localStorage.getItem("racedz-theme");
  } catch {
    return null;
  }
}

function safeGet(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${APPEARANCE_COOKIE_MAX_AGE}; samesite=lax`;
}
