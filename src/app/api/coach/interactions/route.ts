import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { createCoachInteraction } from "@/lib/coach/service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const result = await createCoachInteraction(session.user.id, await readCoachJson(request));
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

