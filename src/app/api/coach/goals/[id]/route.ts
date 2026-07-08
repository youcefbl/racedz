import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { updateCoachGoal, updateCoachGoalSettings, updateCoachGoalStatus } from "@/lib/coach/service";

type GoalRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: GoalRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await readCoachJson(request);
    const isObject = Boolean(body) && typeof body === "object";
    // Three PATCH shapes on the same goal: a status change ({status}), a full goal edit (carries
    // the full onboarding payload, keyed by {goalType}), or a lightweight settings update
    // ({preferredLocale} only, e.g. the coach language selector).
    const goal =
      isObject && "status" in (body as object)
        ? await updateCoachGoalStatus(session.user.id, id, body)
        : isObject && "goalType" in (body as object)
          ? await updateCoachGoal(session.user.id, id, body)
          : await updateCoachGoalSettings(session.user.id, id, body);
    return NextResponse.json({ data: goal });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

