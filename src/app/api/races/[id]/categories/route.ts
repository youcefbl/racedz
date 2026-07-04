import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { canManageRace } from "@/lib/permissions";
import { getRaceEventById } from "@/lib/race-repository";

const createCategorySchema = z.object({
  name: z.string().min(2),
  distanceKm: z.number().positive(),
  elevationGainM: z.number().int().nonnegative().optional(),
  priceDzd: z.number().int().nonnegative().optional(),
  maxParticipants: z.number().int().positive().optional(),
  cutoffTimeMin: z.number().int().positive().optional()
});

type CategoriesRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: CategoriesRouteContext) {
  const { id } = await context.params;
  const race = await getRaceEventById(id);

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  return NextResponse.json({ data: race.categories });
}

export async function POST(request: NextRequest, context: CategoriesRouteContext) {
  const { id } = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required" }, { status: 401 });
  }

  const race = await getRaceEventById(id);

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  if (!canManageRace(session.user.role, race.organizer?.id, session.user.organizationIds)) {
    return NextResponse.json({ error: "You do not have access to this race" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload", details: parsed.error.flatten() }, { status: 422 });
  }

  return NextResponse.json({ data: { ...parsed.data, id: "pending-database-write", raceEventId: id } }, { status: 201 });
}
