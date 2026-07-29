import "server-only";

import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { CoachError } from "@/lib/coach/errors";
import type { CoachLocale } from "@/components/coach/types";

// Cloud voice fallback: when a device has no installed TTS voice for the runner's language (or
// the on-device engine fails outright), the client asks this endpoint to synthesize the cue
// instead. Generated audio is cached to disk keyed by a hash of (locale, text) — since cue
// phrases are drawn from a small set of templates, the same text recurs across many runners and
// runs, so after the first request for a given phrase every later request (any user) is a disk
// read, not a paid OpenAI call. The cache lives under public/uploads/tts-audio, riding on the
// same persistent volume the app's other uploads already use in production.

const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const VOICE_BY_LOCALE: Record<CoachLocale, string> = { en: "alloy", fr: "alloy", ar: "alloy" };

export function isTtsLocale(value: string): value is CoachLocale {
  return value === "en" || value === "fr" || value === "ar";
}

function cacheKeyFor(locale: CoachLocale, text: string): string {
  return createHash("sha256").update(`${locale}::${text}`).digest("hex");
}

function cachePath(locale: CoachLocale, key: string): string {
  return path.join(process.cwd(), "public", "uploads", "tts-audio", locale, `${key}.mp3`);
}

export async function synthesizeSpeech(text: string, locale: CoachLocale): Promise<Buffer> {
  const key = cacheKeyFor(locale, text);
  const file = cachePath(locale, key);

  try {
    return await readFile(file);
  } catch {
    // Not cached yet — generate below.
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new CoachError("Voice generation is not configured.", 503, "OPENAI_NOT_CONFIGURED");
  }

  const model = process.env.OPENAI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;
  const client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 });

  let buffer: Buffer;
  try {
    const response = await client.audio.speech.create({
      model,
      voice: VOICE_BY_LOCALE[locale],
      input: text,
      response_format: "mp3"
    });
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const code = error instanceof OpenAI.APIError ? `OPENAI_${error.status ?? "ERROR"}` : "OPENAI_TTS_FAILED";
    throw new CoachError("Could not generate voice audio.", 502, code);
  }

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  return buffer;
}
