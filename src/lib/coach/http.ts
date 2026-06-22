import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CoachError } from "@/lib/coach/service";

export async function readCoachJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new CoachError("Request body must be valid JSON.", 400, "INVALID_JSON");
  }
}

export function coachErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid coach request.", code: "VALIDATION_ERROR", fields: error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof CoachError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  console.error("Unhandled coach API error", error);
  return NextResponse.json({ error: "Coach request failed.", code: "INTERNAL_ERROR" }, { status: 500 });
}

