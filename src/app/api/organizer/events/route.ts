import { NextRequest, NextResponse } from "next/server";
import { createOrganizerRace, OrganizerError, getOrganizerRaces, requireApprovedOrganizer } from "@/lib/organizer";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function GET() {
  const { session, organization } = await requireApprovedOrganizer();
  const limited = enforceRateLimit(rateLimitKey("organizer-api", session.user.id), 120, 5 * 60_000);
  if (limited) return limited;
  // Bounded so the query can't be unbounded; 200 is far above any realistic per-org count.
  const { items: races, total } = await getOrganizerRaces(organization.id, { page: 1, limit: 200, skip: 0 });

  return NextResponse.json({
    data: races,
    meta: {
      count: total
    }
  });
}

export async function POST(request: NextRequest) {
  const { session, organization } = await requireApprovedOrganizer();
  const limited = enforceRateLimit(rateLimitKey("organizer-api", session.user.id), 120, 5 * 60_000);
  if (limited) return limited;

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
