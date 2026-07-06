"use client";

import { usePathname } from "next/navigation";
import { GpsScrollTrail } from "@/components/layout/gps-scroll-trail";

// The GPS reading-trail belongs on long marketing/content surfaces where scroll momentum
// is the goal — not on in-task app screens (account, coach dashboard, admin, organizer
// tools, auth, checkout), where decorative scroll motion would get in the way. This gate
// mounts the trail once (in the root layout) and shows it only on the allowlisted routes.
const ALLOWED = ["/", "/coach", "/runners", "/organizers", "/pricing", "/about", "/races", "/blog"];

function isAllowed(pathname: string): boolean {
  return ALLOWED.some((base) =>
    base === "/" ? pathname === "/" : pathname === base || pathname.startsWith(`${base}/`)
  );
}

export function GpsScrollTrailGate() {
  const pathname = usePathname();
  if (!pathname || !isAllowed(pathname)) return null;
  // `seed` gives each page its own route; `key` remounts on navigation so it re-seeds.
  return <GpsScrollTrail seed={pathname} key={pathname} />;
}
