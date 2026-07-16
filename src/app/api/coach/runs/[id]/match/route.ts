import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { confirmWorkoutMatch, unlinkRunFromWorkout } from "@/lib/coach/service";

type RunMatchRouteContext = { params: Promise<{ id: string }> };

const confirmSchema = z.object({ workoutId: z.string().min(1).max(64) });

// POST   -> confirm a suggested match: link this run to the given planned workout (RUNNER_CONFIRMED).
// DELETE -> "mark as free run": detach this run from its workout, reopening the workout.
export async function POST(request: Request, context: RunMatchRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const { workoutId } = confirmSchema.parse(await readCoachJson(request));
    const data = await confirmWorkoutMatch(session.user.id, id, workoutId);
    return NextResponse.json({ data });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RunMatchRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const data = await unlinkRunFromWorkout(session.user.id, id);
    return NextResponse.json({ data });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
