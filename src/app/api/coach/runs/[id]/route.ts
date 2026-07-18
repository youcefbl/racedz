import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { updateRunnerRunSchema } from "@/lib/coach/schemas";
import { deleteRun, getRunnerRunDetail, updateRun } from "@/lib/coach/service";

type RunRouteContext = { params: Promise<{ id: string }> };

// One run with its FULL GPS route. List responses carry only a downsampled preview (see
// getRunnerRuns), so an expanded run card calls this to get every point for its map and splits.
export async function GET(_request: Request, context: RunRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const run = await getRunnerRunDetail(session.user.id, id);
    if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    return NextResponse.json({ data: run });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

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

export async function DELETE(_request: Request, context: RunRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const result = await deleteRun(session.user.id, id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
