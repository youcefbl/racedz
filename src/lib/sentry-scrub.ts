import type * as Sentry from "@sentry/nextjs";
import { redactForLogging } from "@/lib/security-log";

// SEC-013: none of the four Sentry init call sites (server/edge/client config,
// sentry.server.config.ts etc.) configured any scrubbing before this — an unhandled exception's
// request context could carry the session cookie, an Authorization header, or a raw request body
// (which for this app can include a password, MFA code, or payment-proof URL) straight to Sentry.
// Shared here so all three real Sentry.init() calls scrub identically instead of drifting.
const SENSITIVE_HEADER_NAMES = new Set(["cookie", "authorization", "set-cookie", "x-csrf-token"]);

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

function scrubEvent<T extends { request?: { headers?: Record<string, string>; cookies?: unknown; data?: unknown }; extra?: unknown; contexts?: unknown }>(
  event: T
): T {
  if (event.request) {
    event.request = {
      ...event.request,
      headers: scrubHeaders(event.request.headers),
      // Never forward cookies to Sentry at all — the session token has no reason to leave the app.
      cookies: undefined,
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
