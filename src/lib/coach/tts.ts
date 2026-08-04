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

// One provider attempt is bounded by PROVIDER_TIMEOUT_MS; the client is allowed PROVIDER_MAX_RETRIES
// further attempts, and the SDK sleeps between them. The cache-key lease must cover that COMPLETE
// budget with margin (FD1-R02): a lease that expires while the owner is still inside its retry
// budget is exactly how a second worker ends up making a duplicate paid call.
const PROVIDER_TIMEOUT_MS = 20_000;
const PROVIDER_MAX_RETRIES = 1;
const CLAIM_LEASE_MS = PROVIDER_TIMEOUT_MS * (PROVIDER_MAX_RETRIES + 1) + 30_000; // 70s
// A waiter polls for the owner's output for as long as that owner could legitimately still be
// working, plus one poll interval.
const WAIT_POLL_MS = 500;
const MAX_WAIT_MS = CLAIM_LEASE_MS + WAIT_POLL_MS;

export async function synthesizeSpeech(text: string, locale: CoachLocale, userId: string): Promise<Buffer> {
  const key = cacheKeyFor(locale, text);
  const file = cachePath(locale, key);

  const cached = await readCached(file);
  if (cached) return cached;

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
  // overshot by racing requests.
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

  // From here every exit must resolve the reservation: SUCCEEDED/FAILED when a provider call was
  // actually made, refunded (deleted) otherwise. A PENDING row left behind would silently consume
  // the runner's daily quota for a full 24 hours (FD1-R02).
  let reservationResolved = false;
  try {
    // Same-phrase single-flight: exactly one worker owns a cache key, and the provider is NEVER
    // called without owning it. Ownership is a leased DB row, so a dead worker cannot wedge the
    // phrase and a slow retry cannot let a second worker start underneath the first.
    const acquired = await acquireOwnershipOrCached(key, file, reservationId);
    if (acquired.cached) {
      await refundReservation(reservationId);
      reservationResolved = true;
      return acquired.cached;
    }
    if (!acquired.owned) {
      // Someone still holds a live lease after the full wait. Refusing is the honest answer:
      // calling anyway is the duplicate spend this exists to prevent. The client may retry — by
      // then the audio is normally cached.
      await refundReservation(reservationId);
      reservationResolved = true;
      throw new CoachError("That voice cue is being prepared. Please try again shortly.", 503, "TTS_BUSY");
    }

    try {
      const client = new OpenAI({ apiKey, timeout: PROVIDER_TIMEOUT_MS, maxRetries: PROVIDER_MAX_RETRIES });
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
        reservationResolved = true;
      } catch (error) {
        const code = error instanceof OpenAI.APIError ? `OPENAI_${error.status ?? "ERROR"}` : "OPENAI_TTS_FAILED";
        await prisma.$executeRaw`
          UPDATE "AiUsageLog" SET "status" = 'FAILED', "errorCode" = ${code} WHERE "id" = ${reservationId}
        `;
        reservationResolved = true;
        throw new CoachError("Could not generate voice audio.", 502, code);
      }

      // Written after the usage row is resolved: a failed disk write must not make a paid call
      // look free, and the caller still gets the audio it paid for.
      await writeCache(file, buffer);
      return buffer;
    } finally {
      await releaseCacheKey(key, reservationId);
    }
  } finally {
    if (!reservationResolved) await refundReservation(reservationId);
  }
}

async function readCached(file: string): Promise<Buffer | null> {
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

async function writeCache(file: string, buffer: Buffer): Promise<void> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buffer);
  } catch {
    // A cache that cannot be written costs the next request another call; it must never fail the
    // request that already has its audio.
  }
}

/**
 * Take ownership of a cache key, or report that someone else holds a LIVE lease.
 *
 * One statement, so two workers cannot both conclude they own it: the insert wins outright, and
 * the ON CONFLICT branch only takes over when the previous owner's lease has actually expired.
 */
async function claimCacheKey(cacheKey: string, ownerId: string): Promise<boolean> {
  const leaseUntil = new Date(Date.now() + CLAIM_LEASE_MS);
  const rows = await getPrisma().$executeRaw`
    INSERT INTO "TtsCacheClaim" ("cacheKey", "ownerId", "claimedAt", "leaseUntil")
    VALUES (${cacheKey}, ${ownerId}, NOW(), ${leaseUntil})
    ON CONFLICT ("cacheKey") DO UPDATE
      SET "ownerId" = ${ownerId}, "claimedAt" = NOW(), "leaseUntil" = ${leaseUntil}
      WHERE "TtsCacheClaim"."leaseUntil" < NOW()
  `;
  return rows === 1;
}

/** Releases only our own claim — never one a takeover has since handed to another worker. */
async function releaseCacheKey(cacheKey: string, ownerId: string): Promise<void> {
  try {
    await getPrisma().$executeRaw`
      DELETE FROM "TtsCacheClaim" WHERE "cacheKey" = ${cacheKey} AND "ownerId" = ${ownerId}
    `;
  } catch {
    // The lease expiry is the backstop: a claim that cannot be deleted is taken over later.
  }
}

/** A refund, not a failure: no provider call was made, so the reservation must not cost quota. */
async function refundReservation(reservationId: string): Promise<void> {
  try {
    await getPrisma().$executeRaw`DELETE FROM "AiUsageLog" WHERE "id" = ${reservationId} AND "status" = 'PENDING'`;
  } catch {
    // Best effort; a stranded PENDING row is visible in the admin usage report.
  }
}

/**
 * Own the cache key, or come back with what its owner produced.
 *
 * Retrying the claim on every tick (rather than waiting the lease out) means a failed owner is
 * taken over as soon as it RELEASES, not a minute later — the common case when the provider
 * errors. Ownership is still the only licence to call the provider.
 */
async function acquireOwnershipOrCached(
  cacheKey: string,
  file: string,
  ownerId: string
): Promise<{ owned?: true; cached?: Buffer }> {
  if (await claimCacheKey(cacheKey, ownerId)) return { owned: true };

  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_MS));
    const cached = await readCached(file);
    if (cached) return { cached };
    if (await claimCacheKey(cacheKey, ownerId)) return { owned: true };
  }
  return {};
}
