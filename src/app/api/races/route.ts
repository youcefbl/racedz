import { NextRequest, NextResponse } from "next/server";
import { findRaceEvents } from "@/lib/race-repository";
import type { EventRegistrationStatus, RaceType } from "@/types/race";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // Public, unauthenticated route — key on IP to slow down scraping.
  const ip = clientIp(request.headers);
  if (ip && !checkRateLimit(`races-api:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const searchParams = request.nextUrl.searchParams;
  const races = await findRaceEvents({
    q: searchParams.get("q") ?? undefined,
    wilaya: searchParams.get("wilaya") ?? undefined,
    type: (searchParams.get("type") as RaceType | null) ?? undefined,
    distance: searchParams.get("distance") ?? undefined,
    registrationStatus: (searchParams.get("registrationStatus") as EventRegistrationStatus | null) ?? undefined
  });

  return NextResponse.json({ data: races });
}
