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

/**
 * Multipart boundary overhead: part headers, the boundary markers, and the trailing CRLFs.
 * Small and roughly fixed, but a body cap set to exactly the file cap would reject a file that is
 * exactly at the limit, so the allowance is added rather than assumed away.
 */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Reads a bounded multipart body.
 *
 * `request.formData()` has the same problem `request.json()` had, and it matters more here: by the
 * time the handler can look at `file.size`, the entire upload has been parsed into memory. Every
 * upload route in this app checked the size that way — a validation rule applied to something
 * already paid for, not a limit.
 *
 * There is no streaming multipart parser in the Web API, so the bound goes on the layer underneath:
 * the body stream is piped through a counting transform that errors past the cap, and `formData()`
 * runs against that. The parser then fails partway instead of completing, which is the point — the
 * bytes after the limit are never read.
 *
 * `maxBytes` is the whole-body cap, so pass the file cap plus {@link MULTIPART_OVERHEAD_BYTES}.
 *
 * @throws {BodyTooLargeError} the body exceeded `maxBytes`
 */
export async function readBoundedFormData(request: Request, maxBytes: number): Promise<FormData> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError(maxBytes);

  const body = request.body;
  if (!body) return request.formData();

  let total = 0;
  let exceeded = false;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        exceeded = true;
        controller.error(new BodyTooLargeError(maxBytes));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  // pipeTo with an explicit catch, NOT pipeThrough. Erroring the transform on purpose rejects the
  // pipe, and pipeThrough leaves that rejection unobserved — which Node treats as an unhandled
  // rejection and, by default, terminates the process for. An oversized upload must be refused,
  // not turned into a way to take the server down.
  void body.pipeTo(counter.writable).catch(() => undefined);
  const bounded = counter.readable;

  // Only content-type is carried over: it holds the multipart boundary the parser needs. Passing
  // content-length along with a stream body is rejected as a mismatch by the runtime.
  const contentType = request.headers.get("content-type");
  const rebuilt = new Request(request.url, {
    method: request.method,
    headers: contentType ? { "content-type": contentType } : undefined,
    body: bounded,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  try {
    return await rebuilt.formData();
  } catch (error) {
    // The parser reports its own failure when the stream is cut mid-part; the reason we cut it is
    // the one worth reporting.
    if (exceeded) throw new BodyTooLargeError(maxBytes);
    throw error;
  }
}
