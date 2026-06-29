import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { updateCoachGoalSettings, updateCoachGoalStatus } from "@/lib/coach/service";

type GoalRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: GoalRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await readCoachJson(request);
    // A settings payload (e.g. the coach response language) is handled separately from status changes.
    const goal = body && typeof body === "object" && "preferredLocale" in body
      ? await updateCoachGoalSettings(session.user.id, id, body)
      : await updateCoachGoalStatus(session.user.id, id, body);
    return NextResponse.json({ data: goal });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

