import "server-only";

import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
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
// read, not a paid OpenAI call. The cache lives under public/uploads/tts-cache on the same
// persistent volume as other uploads, but — like the payment-proof scopes — the path is 403'd by
// Caddy (T0-R03): the ONLY way to read the audio is this authenticated, allowlisted route.

const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const VOICE_BY_LOCALE: Record<CoachLocale, string> = { en: "alloy", fr: "alloy", ar: "alloy" };

export function isTtsLocale(value: string): value is CoachLocale {
  return value === "en" || value === "fr" || value === "ar";
}

function cacheKeyFor(locale: CoachLocale, text: string): string {
  return createHash("sha256").update(`${locale}::${text}`).digest("hex");
}

function cachePath(locale: CoachLocale, key: string): string {
  return path.join(process.cwd(), "public", "uploads", "tts-cache", locale, `${key}.mp3`);
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
  //
  // Check-then-insert is made atomic (DD6-R03) by serializing per user on an advisory lock and
  // writing a PENDING reservation row inside the same transaction: N concurrent misses each take
  // the lock in turn and see every earlier reservation in the count, so the cap cannot be
  // overshot by racing requests. The reservation resolves to SUCCEEDED/FAILED after the provider
  // call, or is refunded (deleted) when a concurrent request for the same phrase supplies the
  // audio first.
  const reservationId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"tts:" + userId}, 0))`;
    const [{ count }] = await tx.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "AiUsageLog"
      WHERE "userId" = ${userId} AND "model" = ${model} AND "createdAt" >= NOW() - INTERVAL '24 hours'
    `;
    if (Number(count) >= TTS_SYNTH_DAILY_LIMIT) {
      throw new CoachError("Daily voice-cue generation limit reached. Try again tomorrow.", 429, "TTS_QUOTA_EXCEEDED");
    }
    await tx.$executeRaw`
      INSERT INTO "AiUsageLog" ("id", "userId", "model", "status") VALUES (${reservationId}, ${userId}, ${model}, 'PENDING')
    `;
  });

  // Same-phrase single-flight (DD6-R03): concurrent misses on one cache key must not each pay for
  // an identical synthesis. An exclusive lockfile elects one synthesizer; the rest poll for the
  // cache file it will write and refund their reservation on a hit. A stale lockfile (process
  // died mid-synthesis) is expired by age so the phrase never wedges permanently.
  await mkdir(path.dirname(file), { recursive: true });
  const lockFile = `${file}.lock`;
  let holdsLock = await tryAcquireLock(lockFile);
  if (!holdsLock) {
    const cached = await waitForConcurrentSynthesis(file, lockFile);
    if (cached) {
      await prisma.$executeRaw`DELETE FROM "AiUsageLog" WHERE "id" = ${reservationId}`;
      return cached;
    }
    // The other synthesizer failed or vanished; try to take over, else proceed unlocked — a rare
    // duplicate provider call is acceptable, silently dropping the runner's cue is not.
    holdsLock = await tryAcquireLock(lockFile);
  }

  const client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 });

  try {
    let buffer: Buffer;
    try {
      const response = await client.audio.speech.create({
        model,
        voice: VOICE_BY_LOCALE[locale],
        input: text,
        response_format: "mp3"
      });
      buffer = Buffer.from(await response.arrayBuffer());
      await prisma.$executeRaw`UPDATE "AiUsageLog" SET "status" = 'SUCCEEDED' WHERE "id" = ${reservationId}`;
    } catch (error) {
      const code = error instanceof OpenAI.APIError ? `OPENAI_${error.status ?? "ERROR"}` : "OPENAI_TTS_FAILED";
      await prisma.$executeRaw`
        UPDATE "AiUsageLog" SET "status" = 'FAILED', "errorCode" = ${code} WHERE "id" = ${reservationId}
      `;
      throw new CoachError("Could not generate voice audio.", 502, code);
    }

    await writeFile(file, buffer);
    return buffer;
  } finally {
    if (holdsLock) {
      await unlink(lockFile).catch(() => undefined);
    }
  }
}

const LOCKFILE_STALE_MS = 60_000;

async function tryAcquireLock(lockFile: string): Promise<boolean> {
  try {
    await writeFile(lockFile, "", { flag: "wx" });
    return true;
  } catch {
    // Held by someone — unless they died and left it behind. Synthesis takes ≤20s (client
    // timeout), so anything older than a minute is abandoned: reclaim it.
    try {
      const info = await stat(lockFile);
      if (Date.now() - info.mtimeMs > LOCKFILE_STALE_MS) {
        await unlink(lockFile).catch(() => undefined);
        await writeFile(lockFile, "", { flag: "wx" });
        return true;
      }
    } catch {
      // Lockfile vanished between attempts — retry once.
      try {
        await writeFile(lockFile, "", { flag: "wx" });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

async function waitForConcurrentSynthesis(file: string, lockFile: string): Promise<Buffer | null> {
  // Poll for up to ~25s (past the 20s provider timeout of the request we are waiting on).
  for (let i = 0; i < 50; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      return await readFile(file);
    } catch {
      // Cache not written yet.
    }
    try {
      await stat(lockFile);
    } catch {
      // Lock released without a cache file: the synthesizer failed. One last cache check covers
      // the write-then-unlock ordering race, then give up waiting.
      return readFile(file).catch(() => null);
    }
  }
  return null;
}
