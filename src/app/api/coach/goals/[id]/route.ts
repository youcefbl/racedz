import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { updateCoachGoalStatus } from "@/lib/coach/service";

type GoalRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: GoalRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const goal = await updateCoachGoalStatus(session.user.id, id, await readCoachJson(request));
    return NextResponse.json({ data: goal });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

