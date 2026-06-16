import { NextRequest, NextResponse } from "next/server";
import { sampleRaces } from "@/lib/races";
import { createRaceSchema } from "@/lib/validations";

export async function GET() {
  return NextResponse.json({
    data: sampleRaces,
    meta: {
      authRequired: true,
      role: "ORGANIZER"
    }
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createRaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event payload", details: parsed.error.flatten() }, { status: 422 });
  }

  return NextResponse.json({ data: { ...parsed.data, id: "pending-database-write", status: "DRAFT" } }, { status: 201 });
}
