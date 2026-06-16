import { NextRequest, NextResponse } from "next/server";
import { getRaceEventById } from "@/lib/race-repository";
import { createRaceSchema } from "@/lib/validations";

type RaceRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RaceRouteContext) {
  const { id } = await context.params;
  const race = await getRaceEventById(id);

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  return NextResponse.json({ data: race });
}

export async function PATCH(request: NextRequest, context: RaceRouteContext) {
  const { id } = await context.params;
  const race = await getRaceEventById(id);

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = createRaceSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid race payload", details: parsed.error.flatten() }, { status: 422 });
  }

  return NextResponse.json({ data: { ...race, ...parsed.data } });
}

export async function DELETE(_request: NextRequest, context: RaceRouteContext) {
  const { id } = await context.params;
  const race = await getRaceEventById(id);

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id, deleted: true } });
}
