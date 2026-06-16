import { NextResponse } from "next/server";

type OrganizerRegistrationsContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: OrganizerRegistrationsContext) {
  const { id } = await context.params;

  return NextResponse.json({
    data: [],
    meta: {
      raceEventId: id,
      authRequired: true,
      role: "ORGANIZER"
    }
  });
}
