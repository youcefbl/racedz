import * as Sentry from "@sentry/nextjs";

// Centralized structured security-event logging (SEC-013). Every call redacts known-sensitive
// field names before the event is serialized, so a call site can pass whatever context it already
// has on hand without needing to remember what's safe to log. Output is one JSON line per event,
// prefixed so it's easy to grep/ship to a log aggregator; a matching Sentry breadcrumb means the
// event shows up alongside whatever error report follows it, without duplicating the redaction
// logic (see redactForLogging(), reused by src/lib/sentry-scrub.ts for actual error events).

export type SecurityEventType =
  | "login_failure"
  | "login_success"
  | "password_reset_requested"
  | "password_reset_completed"
  | "mfa_enrolled"
  | "mfa_disabled"
  | "admin_role_changed"
  | "admin_account_blocked"
  | "admin_account_unblocked"
  | "admin_account_deleted"
  | "rate_limit_blocked"
  | "private_file_denied"
  | "web_handoff_minted"
  | "web_handoff_consumed"
  | "web_handoff_rejected"
  | "cross_site_request_blocked"
  // Native mobile client (/api/v1). Refresh reuse and a PKCE verifier mismatch are the two
  // signals that a device token or an authorization code was intercepted, so they are the ones
  // worth alerting on.
  | "mobile_refresh_reuse_detected"
  | "mobile_pkce_verifier_mismatch"
  | "mobile_logout_all"
  | "data_export_generated"
  | "account_deletion_requested";

const REDACTED = "[redacted]";

// Field names whose value must never appear in a log line, wherever they occur in a passed
// context object — matched case-insensitively by substring since call sites pass ad hoc objects.
// Covers credentials/tokens, financial-proof URLs, precise GPS, and health-adjacent free text.
const SENSITIVE_KEY_PATTERN =
  /password|secret|token|totp|backupcode|proof|route|gps|coordinate|latitude|longitude|\blat\b|\blng\b|symptom|painlevel|fatiguelevel|nationalid|dateofbirth|authorization|\bcookie\b|injurynotes|injuryhistory|healthnotes|chronicconditions|\bphone\b|emergencyphone/i;

// Emails are masked rather than dropped: "which account" is the first question in any security
// triage, but a log that accumulates plaintext addresses becomes a harvestable list. Matched at
// any depth — logSecurityEvent used to mask only a top-level `email`, so a nested
// `{ user: { email } }`, and every error routed through sentry-scrub, kept the address in clear.
const EMAIL_KEY_PATTERN = /email/i;

export function redactForLogging(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redactForLogging(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = REDACTED;
      } else if (EMAIL_KEY_PATTERN.test(key) && typeof nested === "string") {
        out[key] = maskEmail(nested);
      } else {
        out[key] = redactForLogging(nested, depth + 1);
      }
    }
    return out;
  }
  return value;
}

// Emails are useful for security triage (which account?) but shouldn't sit in plaintext logs —
// keep enough to recognize an account without making the log a harvestable email list.
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return REDACTED;
  return `${name.slice(0, 2)}***@${domain}`;
}

export function logSecurityEvent(type: SecurityEventType, context: Record<string, unknown> = {}): void {
  // Masking happens inside redactForLogging at any depth, so nothing extra is needed here.
  const safeContext = redactForLogging(context) as Record<string, unknown>;

  const event = { type, ts: new Date().toISOString(), ...safeContext };
  console.log(`[security] ${JSON.stringify(event)}`);

  Sentry.addBreadcrumb({
    category: "security",
    message: type,
    level: "info",
    data: safeContext
  });
}
