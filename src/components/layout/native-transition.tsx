"use client";

import { usePathname } from "next/navigation";

// Re-keys its subtree on each route change so the CSS enter animation replays.
// The animation itself only applies under `.native-app` (see globals.css), so the
// website renders this as a plain pass-through wrapper with zero visual effect.
export function NativeTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="rz-page">
      {children}
    </div>
  );
}
