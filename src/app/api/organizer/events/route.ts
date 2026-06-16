import { NextRequest, NextResponse } from "next/server";
import { createOrganizerRace, OrganizerError, getOrganizerRaces, requireApprovedOrganizer } from "@/lib/organizer";

export async function GET() {
  const { organization } = await requireApprovedOrganizer();
  const races = await getOrganizerRaces(organization.id);

  return NextResponse.json({
    data: races,
    meta: {
      count: races.length
    }
  });
}

export async function POST(request: NextRequest) {
  const { organization } = await requireApprovedOrganizer();

  try {
    const race = await createOrganizerRace({
      organizationId: organization.id,
      input: await request.json()
    });

    return NextResponse.json({ data: race }, { status: 201 });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    throw error;
  }
}
