"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import { ZIDRUN_MARK_SVG } from "@/components/layout/zidrun-logo-svg";
import { cn } from "@/lib/utils";

// Animated boot splash for the native app. The native (static) Capacitor splash hands off to
// this the moment the web view mounts, so the ZidRun "Z" keeps bouncing on the same teal panel
// as the website instead of freezing on a still logo. Visibility is CSS-driven off `.native-app`
// (added by NativeChrome), so it never appears on the website and there's no hydration flash.
export function NativeSplash() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // Hold briefly so the animation is visible, then fade out and let the app through.
    const timer = window.setTimeout(() => setHidden(true), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  // Look is fully theme-driven from CSS off `[data-theme]` (light / dark / race), which the
  // inline boot script sets on <html> before first paint — so there's no flash and no JS branch.
  return (
    <div
      className={cn("rz-native-splash fixed inset-0 z-[100] items-center justify-center", hidden && "rz-native-splash--hidden")}
      aria-hidden="true"
    >
      <span className="rz-splash-stage">
        <span className="rz-splash-glow" />
        <span className="rz-splash-mark" dangerouslySetInnerHTML={{ __html: ZIDRUN_MARK_SVG }} />
      </span>
      <span className="rz-splash-dots">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
