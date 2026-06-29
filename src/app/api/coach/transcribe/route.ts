import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveCoachEntitlement } from "@/lib/coach/entitlement";
import { CoachError } from "@/lib/coach/errors";
import { coachErrorResponse } from "@/lib/coach/http";
import { transcribeCoachVoiceNote } from "@/lib/coach/service";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Voice input for the coach: accepts a short audio note (multipart form field "audio"),
// transcribes it to text, and returns the transcript for the user to review/edit then send.
// Restricted to PAID subscribers (not the free trial).
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // ~10 MB — a voice note is far smaller.

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required." }, { status: 401 });
  }

  const ip = clientIp(request.headers);
  if (ip) {
    const limit = checkRateLimit(`coach-transcribe:${ip}`, 30, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
  }

  try {
    const entitlement = await resolveCoachEntitlement(session.user.id);
    if (entitlement.tier !== "SUBSCRIBED") {
      throw new CoachError("Voice input is available on the paid subscription only.", 402, "VOICE_REQUIRES_SUBSCRIPTION");
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      throw new CoachError("No audio was received.", 400, "MISSING_AUDIO");
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      throw new CoachError("That recording is too large. Keep voice notes short.", 413, "AUDIO_TOO_LARGE");
    }

    const transcript = await transcribeCoachVoiceNote(session.user.id, audio);
    if (!transcript) {
      throw new CoachError("Could not hear anything. Please try again.", 422, "EMPTY_TRANSCRIPT");
    }

    return NextResponse.json({ data: { transcript } }, { status: 200 });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
