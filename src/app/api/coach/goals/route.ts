import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { createCoachGoal, getCoachGoals } from "@/lib/coach/service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const goals = await getCoachGoals(session.user.id);
    return NextResponse.json({ data: goals, meta: { count: goals.length } });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const goal = await createCoachGoal(session.user.id, await readCoachJson(request));
    return NextResponse.json({ data: goal }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

