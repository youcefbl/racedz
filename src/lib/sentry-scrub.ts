import type * as Sentry from "@sentry/nextjs";
import { redactForLogging } from "@/lib/security-log";

// SEC-013: none of the four Sentry init call sites (server/edge/client config,
// sentry.server.config.ts etc.) configured any scrubbing before this — an unhandled exception's
// request context could carry the session cookie, an Authorization header, or a raw request body
// (which for this app can include a password, MFA code, or payment-proof URL) straight to Sentry.
// Shared here so all three real Sentry.init() calls scrub identically instead of drifting.
const SENSITIVE_HEADER_NAMES = new Set(["cookie", "authorization", "set-cookie", "x-csrf-token"]);

/**
 * Route prefixes whose NEXT path segment is a single-use credential.
 *
 * Redacting the request URL is not paranoia here: these tokens are account-takeover primitives —
 * a password reset link, an email verification, an organization invitation, a group join link, the
 * web handoff — and an unhandled render error on any of those pages attaches the full URL to the
 * event. Header and body scrubbing did nothing for them because the secret was in the path.
 */
const TOKEN_PATH_PREFIXES = new Set(["reset-password", "verify-email", "invite", "join", "handoff"]);

/**
 * Keeps the route, drops the credentials.
 *
 * The route is what makes a report diagnosable, so it survives; the token segment and every query
 * VALUE do not. Query keys are kept because "there was a `token` parameter" is useful context and
 * the key itself is not the secret.
 */
export function scrubUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const absolute = /^https?:\/\//i.test(raw);
    const url = new URL(raw, "https://scrubbed.invalid");

    const segments = url.pathname.split("/").filter(Boolean);
    const scrubbedPath = segments.map((segment, index) =>
      index > 0 && TOKEN_PATH_PREFIXES.has(segments[index - 1]) ? "[redacted]" : segment
    );
    url.pathname = `/${scrubbedPath.join("/")}`;

    const keys = [...new URLSearchParams(url.search).keys()];
    url.search = keys.length ? `?${keys.map((key) => `${key}=[redacted]`).join("&")}` : "";

    return absolute ? url.toString() : `${url.pathname}${url.search}`;
  } catch {
    // An unparseable URL is not worth guessing at; it is also not worth shipping verbatim.
    return "[redacted]";
  }
}

function scrubHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return headers;
  const scrubbed: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    scrubbed[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return scrubbed;
}

// Named types for Sentry's event shape aren't consistently re-exported across @sentry/nextjs
// versions, so these are derived structurally from Sentry.init's own option signatures instead of
// importing "ErrorEvent"/"TransactionEvent" by name — that keeps this file correct even if the
// SDK's public type re-exports shift.
type SentryInitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;
type BeforeSend = NonNullable<SentryInitOptions["beforeSend"]>;
type BeforeSendTransaction = NonNullable<SentryInitOptions["beforeSendTransaction"]>;

function scrubEvent<
  T extends {
    request?: {
      headers?: Record<string, string>;
      cookies?: unknown;
      data?: unknown;
      url?: string;
      query_string?: unknown;
    };
    extra?: unknown;
    contexts?: unknown;
  }
>(event: T): T {
  if (event.request) {
    event.request = {
      ...event.request,
      headers: scrubHeaders(event.request.headers),
      // Never forward cookies to Sentry at all — the session token has no reason to leave the app.
      cookies: undefined,
      // The URL and query string carry single-use tokens on several routes; see scrubUrl.
      url: scrubUrl(event.request.url),
      query_string:
        typeof event.request.query_string === "string"
          ? scrubUrl(`/?${event.request.query_string}`)?.replace(/^\/\?/, "")
          : event.request.query_string,
      data: event.request.data !== undefined ? redactForLogging(event.request.data) : event.request.data
    };
  }
  if (event.extra) {
    event.extra = redactForLogging(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = redactForLogging(event.contexts) as typeof event.contexts;
  }
  return event;
}

export const beforeSend: BeforeSend = (event) => scrubEvent(event);

export const beforeSendTransaction: BeforeSendTransaction = (event) => scrubEvent(event);
