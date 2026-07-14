"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

// Replays the CSS enter animation on each route change WITHOUT remounting the subtree. The old
// `key={pathname}` tore down and rebuilt every node in the page on every navigation (image reloads,
// full re-layout) just to restart the animation; instead we keep one stable wrapper and restart its
// animation before paint, letting React reconcile. Only `.native-app` defines the animation
// (globals.css), and `usePathname()` excludes search params, so this triggers on the exact same
// changes as before — pagination/param changes already reconciled and still do.

// Run before paint on the client (so the restart is flash-free); fall back to useEffect on the
// server render to avoid the SSR useLayoutEffect warning.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function NativeTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    // No-op on the website (no animation defined there) — skip the reflow entirely.
    if (!el || !document.documentElement.classList.contains("native-app")) return;
    el.style.animation = "none";
    void el.offsetWidth; // force reflow so the animation restarts from its first frame
    el.style.animation = "";
  }, [pathname]);

  return (
    <div ref={ref} className="rz-page">
      {children}
    </div>
  );
}
