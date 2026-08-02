import "server-only";

import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { getPrisma } from "@/lib/db";
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

// Per-user daily ceiling on BILLED synth calls (cache misses only — cache hits stay free and
// uncounted). Cue phrases come from a small template set, so a legitimate runner rarely misses the
// cache this often; the cap bounds an account minting endless novel audio (review T0-R03).
const TTS_SYNTH_DAILY_LIMIT = 60;

export async function synthesizeSpeech(text: string, locale: CoachLocale, userId: string): Promise<Buffer> {
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
  const prisma = getPrisma();

  // Cache misses are billed provider calls, so they are capped per user and logged in AiUsageLog
  // like every other AI spend (they previously bypassed accounting entirely — T0-R03). TTS is
  // priced per character, not per token, so the cost column stays NULL ("unpriced") and the row
  // still surfaces in the unpriced counters.
  const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "AiUsageLog"
    WHERE "userId" = ${userId} AND "model" = ${model} AND "createdAt" >= NOW() - INTERVAL '24 hours'
  `;
  if (Number(count) >= TTS_SYNTH_DAILY_LIMIT) {
    throw new CoachError("Daily voice-cue generation limit reached. Try again tomorrow.", 429, "TTS_QUOTA_EXCEEDED");
  }

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
    await prisma.$executeRaw`
      INSERT INTO "AiUsageLog" ("id", "userId", "model", "status") VALUES (${randomUUID()}, ${userId}, ${model}, 'SUCCEEDED')
    `;
  } catch (error) {
    const code = error instanceof OpenAI.APIError ? `OPENAI_${error.status ?? "ERROR"}` : "OPENAI_TTS_FAILED";
    await prisma.$executeRaw`
      INSERT INTO "AiUsageLog" ("id", "userId", "model", "status", "errorCode") VALUES (${randomUUID()}, ${userId}, ${model}, 'FAILED', ${code})
    `;
    throw new CoachError("Could not generate voice audio.", 502, code);
  }

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  return buffer;
}
