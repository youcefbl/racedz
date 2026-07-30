import { NextResponse } from "next/server";
import { getOrganizerRaceRegistrations, requireApprovedOrganizer } from "@/lib/organizer";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

type OrganizerRegistrationsContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: OrganizerRegistrationsContext) {
  const { id } = await context.params;
  const { session, organization } = await requireApprovedOrganizer();
  const limited = enforceRateLimit(rateLimitKey("organizer-api", session.user.id), 120, 5 * 60_000);
  if (limited) return limited;

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
