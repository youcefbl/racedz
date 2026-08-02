import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveCoachEntitlement } from "@/lib/coach/entitlement";
import { CoachError } from "@/lib/coach/errors";
import { coachErrorResponse } from "@/lib/coach/http";
import { isTtsLocale, synthesizeSpeech } from "@/lib/coach/tts";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

// Cloud voice fallback for guided-run cues (see src/lib/coach/tts.ts). GET so the client can
// simply fetch() the phrase + locale; disk-cached results make repeat requests essentially free.
const MAX_TEXT_LENGTH = 200;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required." }, { status: 401 });
  }

  // Generous: a guided workout can prefetch a couple dozen cues at once, and disk-cache hits
  // still count against this limit even though they cost nothing to generate.
  const limited = enforceRateLimit(rateLimitKey("coach-tts", session.user.id), 90, 10 * 60_000);
  if (limited) return limited;

  // This is a billed OpenAI call and was the only coach AI endpoint with no entitlement gate
  // (combined review U-18). Guided cues are part of the trial experience, so — unlike voice
  // transcription, which is SUBSCRIBED-only — TRIAL users keep access; only expired/never-
  // entitled accounts are refused.
  const entitlement = await resolveCoachEntitlement(session.user.id);
  if (entitlement.tier === "NONE") {
    return NextResponse.json(
      { error: "A coach trial or subscription is required for voice cues.", code: "COACH_SUBSCRIPTION_REQUIRED" },
      { status: 402 }
    );
  }

  try {
    const url = new URL(request.url);
    const text = url.searchParams.get("text")?.trim() ?? "";
    const locale = url.searchParams.get("locale") ?? "";

    if (!text) throw new CoachError("Missing text to speak.", 400, "MISSING_TEXT");
    if (text.length > MAX_TEXT_LENGTH) throw new CoachError("That cue is too long to speak.", 400, "TEXT_TOO_LONG");
    if (!isTtsLocale(locale)) throw new CoachError("Unsupported locale.", 400, "UNSUPPORTED_LOCALE");

    const audio = await synthesizeSpeech(text, locale, session.user.id);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        // Content-addressed by (locale, text), so it's safe to cache forever.
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
