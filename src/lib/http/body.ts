/**
 * Bounded request-body reading, shared by every API surface.
 *
 * A route handler that calls `request.json()` has already buffered whatever was sent by the time it
 * can decide the payload was unreasonable. On an endpoint reachable before authentication that is a
 * one-request memory attack: nothing about the caller is known yet, so there is no session to
 * throttle and no account to block — only the size of what we are willing to read.
 *
 * The cap is enforced WHILE reading, not after. Checking `content-length` alone is not enough,
 * because a chunked request carries no `content-length` at all and would sail past the header test
 * and buffer in full before any size check ran. The header check is kept as a cheap first pass — an
 * honest client that declares an oversized body is refused before a single byte is read — and the
 * streaming check is what actually holds.
 *
 * The stream is cancelled the moment the cap is passed, so the sender is stopped rather than
 * allowed to finish into a buffer that is about to be discarded.
 */

/** 64 KB. Comfortably above every real payload this app sends; far below what could hurt us. */
export const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

/** Analytics beacons and other fire-and-forget posts, which are tiny and unauthenticated. */
export const BEACON_MAX_BODY_BYTES = 16 * 1024;

/** Long-form authoring (a race description, a coach conversation) where 64 KB is genuinely tight. */
export const LARGE_MAX_BODY_BYTES = 256 * 1024;

export class BodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super("Request body is too large.");
    this.name = "BodyTooLargeError";
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super("Request body is not valid JSON.");
    this.name = "InvalidJsonError";
  }
}

/** Reads at most `maxBytes` of the body as UTF-8 text, or throws {@link BodyTooLargeError}. */
export async function readBoundedText(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError(maxBytes);

  const body = request.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    // Releasing a cancelled reader throws in some runtimes; the body is done with either way.
    try {
      reader.releaseLock();
    } catch {
      /* no-op */
    }
  }

  if (total === 0) return "";
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

/**
 * Reads and JSON-parses a bounded body.
 *
 * An empty body parses to `{}` rather than throwing, because most callers hand the result straight
 * to a Zod schema and a missing-field report is a better error than "invalid JSON".
 *
 * @throws {BodyTooLargeError} the body exceeded `maxBytes`
 * @throws {InvalidJsonError} what arrived was not JSON
 */
export async function readBoundedJson(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<unknown> {
  const text = await readBoundedText(request, maxBytes);
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}
