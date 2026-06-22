import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { updateTrainingPlanStatus } from "@/lib/coach/service";

type PlanRouteContext = { params: Promise<{ id: string }> };
const updatePlanSchema = z.object({ status: z.enum(["ACTIVE", "CANCELLED"]) });

export async function PATCH(request: Request, context: PlanRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const { status } = updatePlanSchema.parse(await readCoachJson(request));
    const plan = await updateTrainingPlanStatus(session.user.id, id, status);
    return NextResponse.json({ data: plan });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

