"use client";

import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { tapHaptic } from "@/lib/native/haptics";

// App-wide pull-to-refresh, native only. When the user drags down while already at the
// top of the page, a spinner is revealed; releasing past the threshold calls
// router.refresh() — which re-runs the server components, matching how the rest of the
// app refreshes data (revalidatePath / force-dynamic pages). No effect on the website.

const THRESHOLD = 72; // px of pull (after resistance) needed to trigger a refresh
const MAX_PULL = 110; // visual cap on how far the indicator travels
const RESISTANCE = 0.5; // drag feels heavier than a 1:1 finger follow

export function PullToRefresh() {
  const router = useRouter();
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const spinnerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const indicator = indicatorRef.current;
    const spinner = spinnerRef.current;
    if (!indicator || !spinner) return;

    let startY = 0;
    let pulling = false;
    let armed = false; // crossed the threshold this gesture
    let refreshing = false;

    const setVisual = (pull: number) => {
      const eased = Math.min(pull, MAX_PULL);
      indicator.style.transform = `translate(-50%, ${eased}px)`;
      indicator.style.opacity = String(Math.min(1, pull / THRESHOLD));
      spinner.style.transform = `rotate(${pull * 2.4}deg)`;
    };

    const reset = () => {
      indicator.style.transition = "transform 0.25s ease, opacity 0.25s ease";
      indicator.style.transform = "translate(-50%, 0px)";
      indicator.style.opacity = "0";
      indicator.classList.remove("rz-ptr-spin");
    };

    const onStart = (e: TouchEvent) => {
      if (refreshing || window.scrollY > 0 || e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      pulling = true;
      armed = false;
      indicator.style.transition = "none";
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling || refreshing) return;
      const delta = (e.touches[0].clientY - startY) * RESISTANCE;
      if (delta <= 0) {
        // user scrolled back up / moved up — abandon the gesture
        pulling = false;
        reset();
        return;
      }
      setVisual(delta);
      if (delta >= THRESHOLD && !armed) {
        armed = true;
        tapHaptic("medium");
      } else if (delta < THRESHOLD && armed) {
        armed = false;
      }
    };

    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      if (armed && !refreshing) {
        refreshing = true;
        indicator.style.transition = "transform 0.2s ease";
        indicator.style.transform = `translate(-50%, ${THRESHOLD}px)`;
        indicator.style.opacity = "1";
        indicator.classList.add("rz-ptr-spin");
        router.refresh();
        // router.refresh() resolves opaquely; show the spinner briefly then settle.
        window.setTimeout(() => {
          refreshing = false;
          reset();
        }, 900);
      } else {
        reset();
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  return (
    <div ref={indicatorRef} className="rz-ptr" aria-hidden="true">
      <div ref={spinnerRef} className="rz-ptr-ring" />
    </div>
  );
}
