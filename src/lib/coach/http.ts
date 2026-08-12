import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CoachError } from "@/lib/coach/service";
import { BodyTooLargeError, LARGE_MAX_BODY_BYTES, readBoundedJson } from "@/lib/http/body";

/**
 * Coach requests carry the longest bodies in the app — a conversation turn quotes prior messages
 * and a plan payload is a whole training block — so they get the large cap rather than the default.
 * They are the most expensive requests to serve, which is exactly why the body is bounded: every
 * one of them ends in a paid model call.
 */
export async function readCoachJson(request: Request, maxBytes = LARGE_MAX_BODY_BYTES) {
  try {
    return await readBoundedJson(request, maxBytes);
  } catch (error) {
    if (error instanceof BodyTooLargeError) throw new CoachError(error.message, 413, "PAYLOAD_TOO_LARGE");
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

