/**
 * SEC-013: proves the Sentry scrubbing actually redacts, rather than merely being wired up.
 *
 * "beforeSend is configured" and "secrets cannot reach Sentry" are different claims, and only the
 * second one matters. This builds events shaped like the ones this app really produces — an
 * unhandled error on a password-reset page, a failed login POST, a security breadcrumb — and
 * asserts that nothing sensitive survives.
 *
 * The case that motivated the URL handling: several routes carry a single-use credential in the
 * PATH (`/reset-password/<token>`, `/verify-email/<token>`, `/invite/<token>`,
 * `/groups/join/<token>`) or the query (`/auth/handoff`). Those tokens are account-takeover
 * primitives, and an unhandled render error on any of those pages attaches the URL to the event.
 *
 *   npm run test:sentry-scrub
 */
import { beforeSend } from "../src/lib/sentry-scrub";
import { redactForLogging, maskEmail } from "../src/lib/security-log";

let passed = 0;
let failed = 0;

const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${label} — ${detail}`);
  if (cond) passed += 1;
  else failed += 1;
};

/** Anything in here appearing anywhere in the serialized event is a leak. */
const SECRETS = [
  "hunter2-the-password",
  "eyJhbGciOiJIUzI1NiJ9.super-secret-jwt",
  "reset-token-abcdef0123456789abcdef0123456789",
  "handoff-token-fedcba9876543210fedcba98",
  "totp-code-991177", // a TOTP code; distinctive so it cannot collide as a substring
];

function serialize(event: unknown): string {
  return JSON.stringify(event ?? {});
}

function assertNoSecrets(label: string, event: unknown) {
  const text = serialize(event);
  const leaked = SECRETS.filter((secret) => text.includes(secret));
  check(label, leaked.length === 0, leaked.length === 0 ? "no secret survived" : `LEAKED: ${leaked.join(", ")}`);
}

// A helper matching how Sentry actually invokes beforeSend (event, hint).
const send = (event: Record<string, unknown>) =>
  (beforeSend as (e: unknown, h: unknown) => unknown)(event, {});

// ---- 1. A failed login POST: body carries the password and the MFA code ------------------------
assertNoSecrets(
  "login POST body is redacted",
  send({
    request: {
      method: "POST",
      url: "https://zidrun.com/login",
      headers: { cookie: "authjs.session-token=abc", authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.super-secret-jwt" },
      data: { email: "runner@example.com", password: "hunter2-the-password", totp: "totp-code-991177" },
    },
  })
);

// ---- 2. A render error on the password-reset page: the token is in the PATH --------------------
assertNoSecrets(
  "single-use token in the URL path is redacted",
  send({
    request: {
      method: "GET",
      url: "https://zidrun.com/reset-password/reset-token-abcdef0123456789abcdef0123456789",
    },
  })
);

// ---- 3. The web handoff: token in the query string ---------------------------------------------
assertNoSecrets(
  "token in the query string is redacted",
  send({
    request: {
      method: "GET",
      url: "https://zidrun.com/auth/handoff?token=handoff-token-fedcba9876543210fedcba98&next=/account",
      query_string: "token=handoff-token-fedcba9876543210fedcba98&next=/account",
    },
  })
);

// ---- 4. Cookies never leave, whatever they contain ---------------------------------------------
const cookieEvent = send({
  request: { url: "https://zidrun.com/account", cookies: { "authjs.session-token": "eyJhbGciOiJIUzI1NiJ9.super-secret-jwt" } },
}) as { request?: { cookies?: unknown } };
check(
  "cookies are dropped entirely",
  cookieEvent.request?.cookies === undefined,
  `cookies=${JSON.stringify(cookieEvent.request?.cookies)}`
);

// ---- 5. extra/contexts at depth ----------------------------------------------------------------
assertNoSecrets(
  "nested extra and contexts are redacted",
  send({
    extra: { attempt: { credentials: { password: "hunter2-the-password" } } },
    contexts: { session: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.super-secret-jwt" } },
  })
);

// ---- 6. The URL is still USEFUL after scrubbing -------------------------------------------------
// A scrubber that replaced every URL with "[redacted]" would pass every test above and make Sentry
// worthless. The route must survive; only the credential goes.
const kept = send({ request: { url: "https://zidrun.com/reset-password/reset-token-abcdef0123456789abcdef0123456789" } }) as {
  request?: { url?: string };
};
check(
  "the route is preserved so the report stays diagnosable",
  Boolean(kept.request?.url?.includes("/reset-password/")),
  `url=${kept.request?.url}`
);

// ---- 7. Precise GPS and health text (the app's other sensitive classes) -------------------------
const gps = redactForLogging({ route: [{ lat: 36.75, lng: 3.06 }], symptoms: "knee pain since Tuesday" }) as Record<
  string,
  unknown
>;
check(
  "GPS route and symptom text are redacted",
  gps.route === "[redacted]" && gps.symptoms === "[redacted]",
  JSON.stringify(gps)
);

// ---- 8. Emails are masked, not dropped ---------------------------------------------------------
check(
  "email is masked but still recognizable",
  maskEmail("runner@example.com") === "ru***@example.com",
  maskEmail("runner@example.com")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
