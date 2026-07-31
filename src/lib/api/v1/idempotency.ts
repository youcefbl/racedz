import "server-only";

import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { ApiError, apiOk } from "@/lib/api/v1/http";

// Replay protection for non-idempotent mobile mutations. A phone loses the response to a POST far
// more often than a browser does (network switch, doze, process death mid-request), and the user's
// instinct is to tap again. Without this, a dropped 201 becomes a second race registration.
//
// The client sends `Idempotency-Key: <uuid>`; a retry with the same key returns the first stored
// response verbatim instead of re-running the mutation. Records are scoped per user and endpoint.
//
// The protection is a *reservation*, not a check-then-act. `claim()` inserts the row before the
// mutation runs, so the (userId, endpoint, key) unique constraint — not application logic — is what
// serializes concurrent duplicates. Two taps that race now resolve as one winner plus one
// "already in progress", instead of both reading "no record yet" and both registering.

const KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

/**
 * How long a reservation may sit unfinished before another attempt is allowed to take it over.
 * Long enough to cover the registration transaction's own 20s timeout plus request overhead; short
 * enough that a server killed mid-request does not lock the user out of retrying for long.
 */
const STALE_RESERVATION_MS = 60_000;

export function readIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key");
  if (!key) return null;
  if (!KEY_PATTERN.test(key)) {
    throw new ApiError("BAD_REQUEST", "Idempotency-Key is not in a supported format.");
  }
  return key;
}

export type IdempotencyClaim =
  /**
   * This caller owns the mutation. `owner` must be passed back to [completeIdempotent] or
   * [releaseIdempotent]; a stalled attempt whose lease was taken over will find its owner no longer
   * matches and will leave the newer attempt's result alone.
   */
  | { outcome: "claimed"; owner: string }
  /** A previous attempt finished; its response is replayed verbatim. */
  | { outcome: "replay"; response: NextResponse };

/**
 * Reserve this (user, endpoint, key) before running the mutation.
 *
 * Returns `claimed` for exactly one caller. Everyone else either replays the finished response or,
 * if the winner is still running, gets a CONFLICT telling the client to retry shortly — which is
 * honest, and far better than silently performing the mutation twice.
 *
 * A repeat of the same key with a *different* body is rejected rather than replayed: that is a
 * client bug (a key reused across two genuinely different registrations), and returning the first
 * result would tell the user their second registration succeeded when it never ran.
 */
export async function claimIdempotent(
  request: Request,
  userId: string,
  endpoint: string,
  key: string,
  body: unknown
): Promise<IdempotencyClaim> {
  const prisma = getPrisma();
  const requestHash = hashBody(body);
  const owner = randomUUID();

  try {
    await prisma.mobileIdempotencyRecord.create({
      data: { userId, endpoint, key, requestHash, owner, responseCode: null, responseBody: Prisma.DbNull }
    });
    return { outcome: "claimed", owner };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }

  // Lost the insert: someone else got here first.
  const existing = await prisma.mobileIdempotencyRecord.findUnique({
    where: { userId_endpoint_key: { userId, endpoint, key } },
    select: { id: true, requestHash: true, responseCode: true, responseBody: true, createdAt: true, owner: true }
  });

  if (!existing) {
    // Vanishingly rare: the winner released its reservation between the failed insert and this
    // read. Treat it as ours to retry rather than inventing a failure.
    return claimIdempotent(request, userId, endpoint, key, body);
  }

  if (existing.requestHash !== requestHash) {
    throw new ApiError("IDEMPOTENCY_KEY_REUSED", "This request key was already used for a different request.");
  }

  if (existing.responseCode == null) {
    // Still in flight — unless the owner died and left the reservation behind, in which case take
    // it over so a crashed request cannot permanently block this key.
    if (Date.now() - existing.createdAt.getTime() > STALE_RESERVATION_MS) {
      // Claiming the lease means taking the owner too, and the update is conditional on the owner
      // we saw — so exactly one of several simultaneous takeover attempts wins, and the abandoned
      // request can no longer write to this row.
      const takenOver = await prisma.mobileIdempotencyRecord.updateMany({
        where: { id: existing.id, responseCode: null, owner: existing.owner },
        data: { createdAt: new Date(), owner }
      });
      if (takenOver.count === 1) return { outcome: "claimed", owner };
    }

    throw new ApiError("CONFLICT", "This request is already being processed. Please try again in a moment.");
  }

  return {
    outcome: "replay",
    response: apiOk(request, existing.responseBody, {
      status: existing.responseCode,
      headers: { "Idempotent-Replay": "true" }
    })
  };
}

/**
 * Store the result of a successful mutation so a retry with the same key replays it.
 *
 * Scoped to [owner]: an attempt that stalled past its lease and finished late finds the row now
 * belongs to whoever took over, and writes nothing rather than clobbering the newer result.
 */
export async function completeIdempotent(
  userId: string,
  endpoint: string,
  key: string,
  owner: string,
  responseCode: number,
  responseBody: unknown
): Promise<void> {
  await getPrisma().mobileIdempotencyRecord.updateMany({
    where: { userId, endpoint, key, owner },
    data: { responseCode, responseBody: responseBody as Prisma.InputJsonValue }
  });
}

/**
 * Drop a reservation whose mutation failed, so the user can retry with the same key.
 *
 * Only for failures that provably left nothing behind. A mutation that already committed must NOT
 * be released: the reservation is the only thing that lets a retry replay the original success
 * instead of colliding with the row that was written.
 *
 * Scoped to [owner] for the same reason as [completeIdempotent], and to `responseCode: null` so a
 * finished result is never deleted.
 */
export async function releaseIdempotent(
  userId: string,
  endpoint: string,
  key: string,
  owner: string
): Promise<void> {
  await getPrisma().mobileIdempotencyRecord.deleteMany({
    where: { userId, endpoint, key, owner, responseCode: null }
  });
}

function hashBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}
