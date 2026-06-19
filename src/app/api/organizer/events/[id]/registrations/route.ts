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
    data: registrations.items,
    meta: {
      raceEventId: id,
      count: registrations.total,
      page: registrations.page,
      totalPages: registrations.totalPages
    }
  });
}
