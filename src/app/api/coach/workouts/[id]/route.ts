import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { rescheduleWorkout, skipWorkout } from "@/lib/coach/service";

type WorkoutRouteContext = { params: Promise<{ id: string }> };

const SKIP_REASONS = [
  "SCHEDULE",
  "FATIGUE",
  "PAIN_OR_SYMPTOMS",
  "WEATHER",
  "ILLNESS",
  "TRAVEL",
  "MOTIVATION",
  "OTHER"
] as const;

// One PATCH endpoint drives the two state-changing runner actions on a planned workout:
//   { action: "skip", reason?, note? }        -> "I can't do this today"
//   { action: "reschedule", scheduledFor }    -> "Move workout"
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("skip"),
    reason: z.enum(SKIP_REASONS).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional()
  }),
  z.object({
    action: z.literal("reschedule"),
    scheduledFor: z.coerce.date()
  })
]);

export async function PATCH(request: Request, context: WorkoutRouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = bodySchema.parse(await readCoachJson(request));
    const data =
      body.action === "skip"
        ? await skipWorkout(session.user.id, id, body.reason ?? null, body.note ?? null)
        : await rescheduleWorkout(session.user.id, id, body.scheduledFor);
    return NextResponse.json({ data });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
