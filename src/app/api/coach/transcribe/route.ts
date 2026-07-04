import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveCoachEntitlement } from "@/lib/coach/entitlement";
import { CoachError } from "@/lib/coach/errors";
import { coachErrorResponse } from "@/lib/coach/http";
import { transcribeCoachVoiceNote } from "@/lib/coach/service";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

// Voice input for the coach: accepts a short audio note (multipart form field "audio"),
// transcribes it to text, and returns the transcript for the user to review/edit then send.
// Restricted to PAID subscribers (not the free trial).
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // ~10 MB — a voice note is far smaller.
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required." }, { status: 401 });
  }

  // Key the burst limiter on the (unspoofable) session id, not a client-supplied IP
  // header. A hard per-user daily quota is enforced in transcribeCoachVoiceNote.
  const limited = enforceRateLimit(rateLimitKey("coach-transcribe", session.user.id), 20, 60_000);
  if (limited) return limited;

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
    // Only accept real audio container types; reject anything else before spending a
    // billed Whisper call on arbitrary uploaded bytes.
    if (audio.type && !ALLOWED_AUDIO_TYPES.has(audio.type.split(";")[0].trim().toLowerCase())) {
      throw new CoachError("Unsupported audio format.", 415, "AUDIO_UNSUPPORTED_TYPE");
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
