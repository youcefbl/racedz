import "server-only";

import { createHash } from "crypto";
import type { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { ApiError, apiOk } from "@/lib/api/v1/http";

// Replay protection for non-idempotent mobile mutations. A phone loses the response to a POST far
// more often than a browser does (network switch, doze, process death mid-request), and the user's
// instinct is to tap again. Without this, a dropped 201 becomes a second race registration.
//
// The client sends `Idempotency-Key: <uuid>`; a retry with the same key returns the first stored
// response verbatim instead of re-running the mutation. Records are scoped per user and endpoint.

const KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

export function readIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key");
  if (!key) return null;
  if (!KEY_PATTERN.test(key)) {
    throw new ApiError("BAD_REQUEST", "Idempotency-Key is not in a supported format.");
  }
  return key;
}

/**
 * Look for a stored result for this (user, endpoint, key).
 *
 * A repeat of the same key with a *different* body is rejected rather than replayed: that is a
 * client bug (a key reused across two genuinely different registrations), and silently returning
 * the first result would tell the user their second registration succeeded when it never ran.
 */
export async function replayIdempotent(
  request: Request,
  userId: string,
  endpoint: string,
  key: string,
  body: unknown
): Promise<NextResponse | null> {
  const requestHash = hashBody(body);
  const existing = await getPrisma().mobileIdempotencyRecord.findUnique({
    where: { userId_endpoint_key: { userId, endpoint, key } },
    select: { requestHash: true, responseCode: true, responseBody: true }
  });

  if (!existing) return null;

  if (existing.requestHash !== requestHash) {
    throw new ApiError("IDEMPOTENCY_KEY_REUSED", "This request key was already used for a different request.");
  }

  return apiOk(request, existing.responseBody, {
    status: existing.responseCode,
    headers: { "Idempotent-Replay": "true" }
  });
}

/** Store the result of a successful mutation so a retry with the same key replays it. */
export async function recordIdempotent(
  userId: string,
  endpoint: string,
  key: string,
  body: unknown,
  responseCode: number,
  responseBody: unknown
): Promise<void> {
  await getPrisma().mobileIdempotencyRecord.upsert({
    where: { userId_endpoint_key: { userId, endpoint, key } },
    // A concurrent duplicate that lost the race already wrote the same outcome; keep the first.
    update: {},
    create: {
      userId,
      endpoint,
      key,
      requestHash: hashBody(body),
      responseCode,
      responseBody: responseBody as never
    }
  });
}

function hashBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}
