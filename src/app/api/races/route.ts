import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasRole } from "@/lib/permissions";
import { createRaceSchema } from "@/lib/validations";
import { findRaceEvents } from "@/lib/race-repository";
import type { EventRegistrationStatus, RaceType } from "@/types/race";

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required" }, { status: 401 });
  }

  // Only organizers (and staff) may create races.
  if (!hasRole(session.user.role, "ORGANIZER")) {
    return NextResponse.json({ error: "You do not have access to create races" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createRaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid race payload", details: parsed.error.flatten() }, { status: 422 });
  }

  return NextResponse.json(
    {
      data: {
        ...parsed.data,
        id: "pending-database-write",
        status: "DRAFT"
      }
    },
    { status: 201 }
  );
}
