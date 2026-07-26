import { NextResponse } from "next/server";
import { getRaceEventById } from "@/lib/race-repository";

type RaceRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RaceRouteContext) {
  const { id } = await context.params;
  const race = await getRaceEventById(id);

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  return NextResponse.json({ data: race });
}
