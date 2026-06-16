import { NextResponse } from "next/server";
import { getOrganizerRaceRegistrations, requireApprovedOrganizer } from "@/lib/organizer";

type OrganizerRegistrationsContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: OrganizerRegistrationsContext) {
  const { id } = await context.params;
  const { organization } = await requireApprovedOrganizer();
  const registrations = await getOrganizerRaceRegistrations(organization.id, id);

  return NextResponse.json({
    data: registrations,
    meta: {
      raceEventId: id,
      count: registrations.length
    }
  });
}
