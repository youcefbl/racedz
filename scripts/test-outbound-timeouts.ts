/**
 * Every server-side outbound call is time-boxed (`SEC-006` — "timeout, concurrency limits").
 *
 * Node's `fetch` has no default timeout. A provider that accepts the connection and then never
 * answers parks the request handler forever, and each parked handler holds a connection, a pooled
 * database client, and its own memory. Enough of them and the app stops serving anyone — an outage
 * caused entirely by a third party, with no attacker involved.
 *
 * The audit that produced this file found four unbounded calls in production paths: both Firebase
 * calls (push delivery and its OAuth token exchange), the Resend email send, and the custom-DEM
 * elevation POST. Two others were bounded correctly but by hand, which is why the rule below is
 * "use the shared helper" rather than "have a timeout somewhere": a bespoke-but-correct variant is
 * indistinguishable from a missing one to any check that has to run on every future commit.
 *
 * Client-side files are exempt. A `fetch` in the browser spends the USER's tab, not a server
 * handler, and the failure mode is a spinner rather than an outage.
 *
 *   npm run test:outbound-timeouts
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { createServer } from "http";
import type { AddressInfo } from "net";
import path from "path";

const ROOT = process.cwd();
const SERVER_ROOTS = [path.join(ROOT, "src", "lib"), path.join(ROOT, "src", "app", "api")];

/**
 * Files that legitimately call bare `fetch`, each with the reason it is not a server handler.
 * An entry here is a claim someone has to defend at review time, which is the point.
 */
const EXEMPT: Record<string, string> = {
  "src/lib/http/outbound.ts": "the helper itself — it is the one place bare fetch is correct",
  "src/lib/notifications/push-client.ts": "browser: registers a push subscription from the user's tab",
  "src/lib/native/cues.ts": "browser/WebView: fetches its own origin's TTS endpoint during a run",
  "src/lib/native/gpx-export.ts": "browser: downloads the user's own GPX from our origin"
};

const problems: string[] = [];

function walk(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

// `fetch(` not preceded by a dot (so `response.fetch(`-style member calls are not matched) and not
// part of `fetchWithTimeout(`.
const BARE_FETCH = /(?<![.\w])fetch\s*\(/;

for (const root of SERVER_ROOTS) {
  for (const file of walk(root)) {
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    if (EXEMPT[relative]) continue;
    const source = readFileSync(file, "utf8");
    // A file marked "use client" runs in the browser even when it lives under src/lib.
    if (/^\s*["']use client["']/m.test(source)) continue;

    source.split(/\r?\n/).forEach((line, index) => {
      if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
      if (!BARE_FETCH.test(line)) return;
      problems.push(
        `${relative}:${index + 1}: bare fetch() in a server path — use fetchWithTimeout() from @/lib/http/outbound, ` +
          "or add the file to EXEMPT here with the reason it runs in the browser"
      );
    });
  }
}

// The helper's own contract. A timeout that does not actually fire is worse than none, because the
// gate above would then certify unbounded calls as bounded.
async function assertHelperBehaviour() {
  const { fetchWithTimeout, OutboundTimeoutError } = await import("../src/lib/http/outbound");

  // A real server that ACCEPTS the connection and then never answers — the exact failure this
  // guards against, and the one a rate limit cannot help with. An unroutable IP was the first
  // attempt and was wrong: most networks refuse it immediately, so the request failed fast and the
  // deadline was never exercised at all.
  const hung = createServer(() => {
    /* deliberately never responds */
  });
  hung.on("connection", (socket) => socket.unref());
  await new Promise<void>((resolve) => hung.listen(0, "127.0.0.1", resolve));
  const port = (hung.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/hang`;

  try {
    const start = Date.now();
    try {
      await fetchWithTimeout(url, { timeoutMs: 300 });
      problems.push("fetchWithTimeout resolved against a server that never answers — the deadline did not fire");
    } catch (error) {
      const elapsed = Date.now() - start;
      if (!(error instanceof OutboundTimeoutError)) {
        problems.push(`fetchWithTimeout threw ${(error as Error).name}, expected OutboundTimeoutError`);
      } else {
        if (/\/hang/.test(error.message)) {
          problems.push("OutboundTimeoutError leaked the request path — it must name the host only");
        }
        if (elapsed > 3000) problems.push(`fetchWithTimeout took ${elapsed}ms to honour a 300ms deadline`);
      }
    }

    // A caller who cancels first must not be reported as a provider timeout: that would send an
    // operator hunting an outage that never happened.
    const cancelled = new AbortController();
    cancelled.abort();
    try {
      await fetchWithTimeout(url, { timeoutMs: 5000, signal: cancelled.signal });
      problems.push("fetchWithTimeout ignored an already-aborted caller signal");
    } catch (error) {
      if (error instanceof OutboundTimeoutError) {
        problems.push("a caller's own cancellation was misreported as an outbound timeout");
      }
    }
  } finally {
    await new Promise<void>((resolve) => hung.close(() => resolve()));
  }
}

// Wrapped rather than top-level await: tsx transpiles these scripts to CJS, where top-level await
// is a syntax error.
async function main() {
  await assertHelperBehaviour();

  if (problems.length > 0) {
    console.error("Outbound timeout check FAILED:\n");
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    process.exit(1);
  }

  console.log("Outbound timeout check passed — every server-side fetch is time-boxed, and the deadline fires.");
}

void main();
