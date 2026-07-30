import { NextResponse } from "next/server";
import { getRaceEventById } from "@/lib/race-repository";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

type RaceRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RaceRouteContext) {
  const ip = clientIp(request.headers);
  if (ip && !checkRateLimit(`races-api:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { id } = await context.params;
  const race = await getRaceEventById(id);

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  return NextResponse.json({ data: race });
}
