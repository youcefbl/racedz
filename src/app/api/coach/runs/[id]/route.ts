import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { updateRunnerRunSchema } from "@/lib/coach/schemas";
import { updateRun } from "@/lib/coach/service";

type RunRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RunRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const fields = updateRunnerRunSchema.parse(await readCoachJson(request));
    const run = await updateRun(session.user.id, id, fields);
    return NextResponse.json({ data: run });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
