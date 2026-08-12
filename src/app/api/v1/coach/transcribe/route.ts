import { coachErrorToApiError } from "@/lib/api/v1/coach";
import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { resolveCoachEntitlement } from "@/lib/coach/entitlement";
import { transcribeCoachVoiceNote } from "@/lib/coach/service";
import { CoachError } from "@/lib/coach/errors";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { BodyTooLargeError, MULTIPART_OVERHEAD_BYTES, readBoundedFormData } from "@/lib/http/body";

export const dynamic = "force-dynamic";

// Mirrors the website's /api/coach/transcribe for bearer-authenticated clients (COACHPAR-001).
// Adds no AI behaviour of its own: transcribeCoachVoiceNote() owns the health-consent gate, the
// per-user daily ceiling, and the AiUsageLog accounting, so the phone cannot reach the provider on
// terms the website could not.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // ~10 MB — a voice note is far smaller.
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  // Android's MediaRecorder MPEG_4 container is commonly labelled this way.
  "audio/aac",
  "audio/m4a",
  "audio/x-m4a"
]);

/**
 * Transcribe a short voice note and return the text for the runner to REVIEW.
 *
 * The transcript is deliberately never sent onward as a question by this endpoint: speech
 * recognition mishears, and auto-asking would spend one of the runner's daily coach messages on a
 * sentence they never approved. The client fills its composer with the text instead.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  // Burst limiter on the session-derived user id, not a client-supplied header. The hard daily
  // quota lives in transcribeCoachVoiceNote().
  const limited = enforceRateLimit(rateLimitKey("v1-coach-transcribe", viewer.id), 20, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many voice notes. Try again shortly."));

  try {
    // Voice input is a paid-subscription feature, unlike the guided-run cues that trial users get.
    const entitlement = await resolveCoachEntitlement(viewer.id);
    if (entitlement.tier !== "SUBSCRIBED") {
      throw new CoachError("Voice input is available on the paid subscription only.", 402, "VOICE_REQUIRES_SUBSCRIPTION");
    }

    const formData = await readBoundedFormData(request, MAX_AUDIO_BYTES + MULTIPART_OVERHEAD_BYTES).catch((error) => {
      if (error instanceof BodyTooLargeError) {
        throw new CoachError("That recording is too large. Keep voice notes short.", 413, "AUDIO_TOO_LARGE");
      }
      return null;
    });
    const audio = formData?.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      throw new CoachError("No audio was received.", 400, "MISSING_AUDIO");
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      throw new CoachError("That recording is too large. Keep voice notes short.", 413, "AUDIO_TOO_LARGE");
    }
    // Only real audio container types: refuse anything else before spending a billed call on
    // arbitrary uploaded bytes.
    if (audio.type && !ALLOWED_AUDIO_TYPES.has(audio.type.split(";")[0].trim().toLowerCase())) {
      throw new CoachError("Unsupported audio format.", 415, "AUDIO_UNSUPPORTED_TYPE");
    }

    const transcript = await transcribeCoachVoiceNote(viewer.id, audio);
    if (!transcript) {
      throw new CoachError("Could not hear anything. Please try again.", 422, "EMPTY_TRANSCRIPT");
    }

    return apiOk(request, { transcript });
  } catch (error) {
    if (error instanceof CoachError) throw coachErrorToApiError(error);
    throw error;
  }
});
