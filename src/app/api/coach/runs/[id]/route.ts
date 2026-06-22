import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { setRunVisibility } from "@/lib/coach/service";

type RunRouteContext = { params: Promise<{ id: string }> };
const updateRunSchema = z.object({ isPublic: z.boolean() });

export async function PATCH(request: Request, context: RunRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const { isPublic } = updateRunSchema.parse(await readCoachJson(request));
    const run = await setRunVisibility(session.user.id, id, isPublic);
    return NextResponse.json({ data: run });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
