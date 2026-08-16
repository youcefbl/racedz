/**
 * Bounded OUTBOUND requests, the mirror of `body.ts`.
 *
 * `body.ts` bounds how much a caller can send us. This bounds how long someone else can hold onto
 * one of our request handlers. They are the same class of problem from opposite directions, and the
 * outbound half was the one still missing (`SEC-006`: "timeout, concurrency").
 *
 * Node's `fetch` has NO default timeout. A provider that accepts the connection and then never
 * answers — a hung Resend, a black-holed FCM endpoint, a DEM host behind a broken route — parks the
 * handler indefinitely. Every parked handler holds a connection, a database client from the pool,
 * and its own memory. Enough of them and the app stops serving anyone, without a single malicious
 * request being sent: the outage arrives from a third party we do not control.
 *
 * That is also why the limit is a wall-clock deadline rather than a socket timeout. A slow trickle
 * of bytes keeps a socket alive indefinitely while making no useful progress, and `AbortSignal
 * .timeout()` covers the whole exchange rather than the gaps within it.
 *
 * Timeouts are named per provider rather than shared, because the honest upper bound differs by an
 * order of magnitude: an email accepted in 3 seconds and an AI completion that legitimately runs
 * for a minute cannot share a number without one of them being wrong.
 */

/** Transactional email (Resend). Fast or not worth waiting for — the send is retried by the caller. */
export const EMAIL_TIMEOUT_MS = 10_000;

/** Push delivery and its OAuth token exchange (FCM). */
export const PUSH_TIMEOUT_MS = 10_000;

/** Public geo/weather APIs. Best-effort enrichment: the feature degrades rather than fails. */
export const GEO_TIMEOUT_MS = 8_000;

/** Anything unnamed. Deliberately short — an outbound call with no considered budget gets a tight one. */
export const DEFAULT_OUTBOUND_TIMEOUT_MS = 15_000;

export class OutboundTimeoutError extends Error {
  constructor(
    readonly url: string,
    readonly timeoutMs: number
  ) {
    // The host, never the full URL: query strings on these calls carry coordinates and provider
    // keys, and this message reaches logs and Sentry.
    super(`Outbound request to ${safeHost(url)} timed out after ${timeoutMs}ms`);
    this.name = "OutboundTimeoutError";
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown host";
  }
}

/**
 * `fetch` with a mandatory deadline.
 *
 * Composes with a caller's own signal rather than replacing it, so an existing cancellation path
 * (a request the user abandoned, a parent operation giving up) still wins — the request ends on
 * whichever fires first.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_OUTBOUND_TIMEOUT_MS, signal, ...rest } = init;
  const deadline = AbortSignal.timeout(timeoutMs);
  const composed = signal ? anySignal([signal, deadline]) : deadline;

  try {
    return await fetch(url, { ...rest, signal: composed });
  } catch (error) {
    // Distinguish OUR deadline from the caller's cancellation. Both surface as an AbortError, and
    // reporting a user-cancelled request as a provider timeout would send us hunting a phantom
    // outage in the logs.
    if (deadline.aborted) throw new OutboundTimeoutError(url, timeoutMs);
    throw error;
  }
}

/**
 * First signal to abort wins.
 *
 * `AbortSignal.any` exists in current Node, but this runs on the Next server, the Edge runtime and
 * in tests, so the composition is done by hand rather than assuming the newest of the three.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const already = signals.find((s) => s.aborted);
  if (already) return already;

  const controller = new AbortController();
  const onAbort = (event: Event) => {
    controller.abort((event.target as AbortSignal).reason);
    for (const signal of signals) signal.removeEventListener("abort", onAbort);
  };
  for (const signal of signals) signal.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}
