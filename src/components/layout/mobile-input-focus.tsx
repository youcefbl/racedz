"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

const EDITABLE_SELECTOR = "input:not([type=hidden]), textarea, select, [contenteditable=\"true\"]";

function isEditable(element: Element | null): element is HTMLElement {
  return Boolean(element?.matches(EDITABLE_SELECTOR));
}

/** Keeps the active control visible after the Android keyboard resizes the WebView. */
export function MobileInputFocus() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let timer: number | undefined;

    const keepFocusedControlVisible = (delay = 0) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const active = document.activeElement;
        if (!isEditable(active)) return;

        // The keyboard changes visualViewport after focus. Centering the field after that
        // resize avoids the common “keyboard covers what I am typing” WebView failure while
        // leaving already-visible controls where the user put them.
        active.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      }, delay);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (isEditable(event.target as Element | null)) keepFocusedControlVisible(180);
    };

    const onViewportChange = () => {
      if (isEditable(document.activeElement)) keepFocusedControlVisible(40);
    };

    document.addEventListener("focusin", onFocusIn);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
