"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

// Native-app shell: adds the `.native-app` class (so CSS can switch on app-only styling),
// wires the status bar / splash / hardware back button, and renders the bottom tab bar.
// Everything is guarded so the website build and runtime are unaffected.

const SURFACE_BY_THEME: Record<string, string> = {
  light: "#ffffff",
  dark: "#101827",
  race: "#160b24"
};

export function NativeChrome() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    root.classList.add("native-app");

    let statusBarApi: typeof import("@capacitor/status-bar") | null = null;

    async function applyStatusBar() {
      if (!statusBarApi) return;
      const theme = root.dataset.theme ?? "light";
      const dark = theme === "dark" || theme === "race";
      try {
        // Style.Light = light icons (for dark backgrounds); Style.Dark = dark icons (for light).
        await statusBarApi.StatusBar.setStyle({ style: dark ? statusBarApi.Style.Light : statusBarApi.Style.Dark });
        await statusBarApi.StatusBar.setBackgroundColor({ color: SURFACE_BY_THEME[theme] ?? "#ffffff" });
      } catch {
        // setBackgroundColor is Android-only; ignore elsewhere.
      }
    }

    let observer: MutationObserver | null = null;
    let removeBackButton: (() => void) | undefined;
    let removeKeyboard: (() => void) | undefined;

    (async () => {
      // Hide the boot splash first so the app becomes visible as early as possible…
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        /* plugin missing — fine */
      }

      // …then wire the remaining, independent plugins in parallel (each dynamic import + bridge
      // call is a separate round-trip; awaiting them sequentially needlessly serialized boot).
      await Promise.all([
        (async () => {
          try {
            statusBarApi = await import("@capacitor/status-bar");
            await applyStatusBar();
            observer = new MutationObserver(() => void applyStatusBar());
            observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
          } catch {
            /* ignore */
          }
        })(),
        (async () => {
          try {
            const { App } = await import("@capacitor/app");
            const handle = await App.addListener("backButton", ({ canGoBack }) => {
              if (canGoBack || window.history.length > 1) {
                window.history.back();
              } else {
                void App.exitApp();
              }
            });
            removeBackButton = () => void handle.remove();
          } catch {
            /* ignore */
          }
        })(),
        (async () => {
          try {
            const { Keyboard } = await import("@capacitor/keyboard");
            // Hide the bottom tab bar while the keyboard is up (native apps don't float a tab bar over it).
            const show = await Keyboard.addListener("keyboardWillShow", () => root.classList.add("keyboard-open"));
            const hide = await Keyboard.addListener("keyboardWillHide", () => root.classList.remove("keyboard-open"));
            removeKeyboard = () => {
              void show.remove();
              void hide.remove();
            };
          } catch {
            /* keyboard plugin unavailable — fine */
          }
        })()
      ]);
    })();

    return () => {
      observer?.disconnect();
      removeBackButton?.();
      removeKeyboard?.();
    };
  }, []);

  return <MobileTabBar />;
}
