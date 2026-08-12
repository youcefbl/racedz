/**
 * SEC-006: proves request bodies are actually bounded, and stay bounded.
 *
 * Two different claims, so two different kinds of check:
 *
 *   1. The reader really stops. Not "there is a size check somewhere" but: a chunked upload with no
 *      content-length — the case a header check cannot see — is refused, and refused *while
 *      streaming*, without the whole payload ever being buffered. That last part is what makes the
 *      limit a defence rather than a validation rule; a cap applied after `await request.json()`
 *      has already paid the cost it was meant to avoid.
 *
 *   2. No route bypasses it. A single handler calling `request.json()` directly reopens the hole
 *      for that endpoint, and it is a one-line mistake to make in a new route. So this walks every
 *      route in the app and fails on a raw body read, the same way the authz matrix walks every
 *      route and fails on a missing guard.
 *
 *   npm run test:body-limits
 */
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import {
  BEACON_MAX_BODY_BYTES,
  BodyTooLargeError,
  DEFAULT_MAX_BODY_BYTES,
  InvalidJsonError,
  readBoundedJson,
} from "../src/lib/http/body";

let passed = 0;
let failed = 0;
const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${label} — ${detail}`);
  if (cond) passed += 1;
  else failed += 1;
};

/**
 * A request whose body arrives in chunks and declares no content-length, like a real chunked POST.
 * `pulled` counts how much the reader actually asked for, which is how we tell "refused" apart
 * from "refused, but only after swallowing all of it".
 */
function chunkedRequest(totalBytes: number, chunkBytes = 8 * 1024, headers: Record<string, string> = {}) {
  const counter = { pulled: 0 };
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close();
        return;
      }
      const size = Math.min(chunkBytes, totalBytes - sent);
      sent += size;
      counter.pulled += size;
      controller.enqueue(new Uint8Array(size).fill(0x61)); // 'a'
    },
  });
  const request = new Request("https://zidrun.com/api/anything", {
    method: "POST",
    body: stream,
    headers,
    // Node's undici requires this for a streaming body.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, counter };
}

/** Blanks out comments while preserving line numbers, so the reported line still points at the code. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, prefix: string) => prefix);
}

async function expectRejected(label: string, run: () => Promise<unknown>) {
  try {
    await run();
    check(label, false, "it was ACCEPTED — the cap did not hold");
    return null;
  } catch (error) {
    check(label, error instanceof BodyTooLargeError, `threw ${(error as Error)?.name}`);
    return error;
  }
}

async function main() {
  // ---- 1. The case a content-length check cannot catch --------------------------------------------
  {
    const { request, counter } = chunkedRequest(4 * 1024 * 1024); // 4 MB, no content-length
    await expectRejected("a 4 MB chunked body with no content-length is refused", () => readBoundedJson(request));
    // The reader may overshoot by at most the chunk that trips the limit; it must not read the rest.
    check(
      "...and is stopped mid-stream rather than buffered in full",
      counter.pulled <= DEFAULT_MAX_BODY_BYTES + 8 * 1024,
      `read ${Math.round(counter.pulled / 1024)} KB of 4096 KB before cancelling`
    );
  }

  // ---- 2. A lying content-length does not buy more room -------------------------------------------
  {
    const { request } = chunkedRequest(1024 * 1024, 8 * 1024, { "content-length": "10" });
    await expectRejected("a body that under-declares its content-length is still refused", () =>
      readBoundedJson(request)
    );
  }

  // ---- 3. An honest oversized declaration is refused on the header alone ---------------------------
  {
    const { request, counter } = chunkedRequest(1024 * 1024, 8 * 1024, { "content-length": String(1024 * 1024) });
    await expectRejected("an honestly declared oversized body is refused", () => readBoundedJson(request));
    // Not zero: the stream fills its own internal queue with one chunk as soon as it is constructed,
    // before anything here touches it. What matters is that the 1 MB upload was never drained — the
    // header check returns before getReader() is ever called.
    check(
      "...on the header alone, without draining the upload",
      counter.pulled <= 8 * 1024,
      `source produced ${counter.pulled} bytes of 1048576`
    );
  }

  // ---- 4. The tighter beacon cap is a real, separate limit ------------------------------------------
  {
    const { request } = chunkedRequest(64 * 1024, 4 * 1024); // fine by default, too big for a beacon
    await expectRejected("the beacon cap rejects what the default cap would allow", () =>
      readBoundedJson(request, BEACON_MAX_BODY_BYTES)
    );
  }

  // ---- 5. Normal requests are untouched -------------------------------------------------------------
  // A limit that also broke ordinary traffic would pass every test above.
  {
    const body = JSON.stringify({ runId: "run_123", note: "a".repeat(2000) });
    const ok = (await readBoundedJson(
      new Request("https://zidrun.com/api/anything", { method: "POST", body })
    )) as Record<string, unknown>;
    check("a normal request body still parses", ok.runId === "run_123", JSON.stringify(ok).slice(0, 40));

    const empty = await readBoundedJson(new Request("https://zidrun.com/api/anything", { method: "POST" }));
    check("an empty body reads as {}", JSON.stringify(empty) === "{}", JSON.stringify(empty));

    let invalid: unknown;
    try {
      await readBoundedJson(new Request("https://zidrun.com/api/anything", { method: "POST", body: "not json" }));
    } catch (error) {
      invalid = error;
    }
    check("malformed JSON is reported as such", invalid instanceof InvalidJsonError, `${(invalid as Error)?.name}`);
  }

  // ---- 6. No route reads a body without the bound ----------------------------------------------------
  const API_ROOT = path.join(process.cwd(), "src", "app", "api");
  const RAW_READ = /\b(?:request|req)\s*\.\s*(?:json|text)\s*\(\s*\)/;

  /** Routes allowed to read raw, with the reason. Adding here should feel like a decision. */
  const RAW_READ_ALLOWED: Record<string, string> = {};

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else if (entry === "route.ts") out.push(full);
    }
    return out.sort();
  }

  let scanned = 0;
  for (const file of walk(API_ROOT)) {
    const relative = path.relative(API_ROOT, file).split(path.sep).join("/");
    if (relative in RAW_READ_ALLOWED) continue;
    // Comments are stripped first: several routes explain in prose why they do NOT call
    // request.json(), and a scanner that reads documentation as if it were code reports the
    // best-documented files as the broken ones.
    const source = stripComments(readFileSync(file, "utf8"));
    scanned += 1;
    if (RAW_READ.test(source)) {
      const line = source.split("\n").findIndex((text) => RAW_READ.test(text)) + 1;
      check(
        `${relative} bounds its body read`,
        false,
        `line ${line} reads the body directly — use readBoundedJson from @/lib/http/body`
      );
    } else {
      passed += 1;
    }
  }
  console.log(`\n${scanned} routes scanned · ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
