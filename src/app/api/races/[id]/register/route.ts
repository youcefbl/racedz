import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRaceRegistrationForUser, RegistrationError } from "@/lib/registrations";

type RegisterRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RegisterRouteContext) {
  const { id } = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required to register for a race" }, { status: 401 });
  }

  try {
    const registration = await createRaceRegistrationForUser({
      userId: session.user.id,
      raceEventId: id,
      input: await request.json()
    });

    return NextResponse.json({ data: registration }, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
