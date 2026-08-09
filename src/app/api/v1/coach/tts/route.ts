import { NextResponse } from "next/server";
import { apiError, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { coachErrorToApiError } from "@/lib/api/v1/coach";
import { resolveCoachEntitlement } from "@/lib/coach/entitlement";
import { CoachError } from "@/lib/coach/errors";
import { isAllowedCueText } from "@/lib/coach/tts-allowlist";
import { isTtsLocale, synthesizeSpeech } from "@/lib/coach/tts";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 200;

/**
 * Cloud voice for a guided-run cue — the mobile twin of /api/coach/tts.
 *
 * Exists because the device's own text-to-speech is not always usable: on the M21 there is no
 * `ara-DZA` voice at all, so RunVoice fell back to an English voice reading Arabic text aloud. That
 * is worse than silence — it is unintelligible mid-run, and it is the runner's own language being
 * mangled. This endpoint is the same fallback the website already uses.
 *
 * Deliberately identical in its guards to the web route rather than "simpler because it is mobile":
 * the entitlement gate (TRIAL keeps access, expired does not), the cue allowlist that stops this
 * being a general text-to-speech service for arbitrary user text, and the length cap are all the
 * same calls. The only difference is bearer auth instead of a session cookie.
 *
 * Returns raw audio, not the ApiEnvelope every other v1 route uses. Wrapping ~20 KB of MP3 in
 * base64 inside JSON would cost a third more bytes on a mobile connection and force the client to
 * decode it before it can play — for a cue that has to be heard *now*, mid-stride.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  // Matches the web route's budget: a guided workout can prefetch a couple of dozen cues at once,
  // and disk-cache hits still count even though they cost nothing to generate.
  const limited = enforceRateLimit(rateLimitKey("v1-coach-tts", viewer.id), 90, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many voice cues. Try again shortly."));

  try {
    const entitlement = await resolveCoachEntitlement(viewer.id);
    if (entitlement.tier === "NONE") {
      throw new CoachError("A coach trial or subscription is required for voice cues.", 402, "COACH_SUBSCRIPTION_REQUIRED");
    }

    const url = new URL(request.url);
    const text = url.searchParams.get("text")?.trim() ?? "";
    const locale = url.searchParams.get("locale") ?? "";

    if (!text) throw new CoachError("Missing text to speak.", 400, "MISSING_TEXT");
    if (text.length > MAX_TEXT_LENGTH) throw new CoachError("That cue is too long to speak.", 400, "TEXT_TOO_LONG");
    if (!isTtsLocale(locale)) throw new CoachError("Unsupported locale.", 400, "UNSUPPORTED_LOCALE");
    if (!isAllowedCueText(text, locale)) throw new CoachError("That is not a known coaching cue.", 400, "UNSUPPORTED_CUE");

    const audio = await synthesizeSpeech(text, locale, viewer.id);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        // Content-addressed by (locale, text). `private` and never `public`: a shared or proxy
        // cache must not serve this to a client that did not pass the auth and entitlement checks.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (error instanceof CoachError) throw coachErrorToApiError(error);
    throw error;
  }
});
