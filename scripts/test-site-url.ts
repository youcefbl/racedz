import assert from "node:assert/strict";
import { canonicalBaseUrl, canonicalOrigin } from "../src/lib/site-url";

/*
 * Regression guard for the production browser sign-in failure: /api/v1/auth/authorize built its
 * login hand-off from the incoming request's origin, which behind the reverse proxy is the address
 * Next binds to. Signed-out runners on the native app were sent to https://0.0.0.0:3003/login and
 * got a connection error. NextAuth had the correct origin on the same response.
 */

type Env = { NEXTAUTH_URL?: string; AUTH_URL?: string; NEXT_PUBLIC_APP_URL?: string };
const KEYS = ["NEXTAUTH_URL", "AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const;
const saved: Env = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
function withEnv(env: Env, run: () => void) {
  for (const k of KEYS) delete process.env[k];
  for (const k of KEYS) if (env[k]) process.env[k] = env[k];
  try {
    run();
  } finally {
    for (const k of KEYS) delete process.env[k];
    for (const k of KEYS) if (saved[k]) process.env[k] = saved[k];
  }
}

const bindAddress = "https://0.0.0.0:3003";

withEnv({ NEXTAUTH_URL: "https://zidrun.com" }, () => {
  assert.equal(canonicalOrigin(bindAddress), "https://zidrun.com");
  assert.equal(
    new URL("/login", canonicalOrigin(bindAddress)).toString(),
    "https://zidrun.com/login",
    "the login hand-off must not carry the bind address"
  );
});

withEnv({ NEXTAUTH_URL: "https://zidrun.com/" }, () => {
  assert.equal(canonicalOrigin(bindAddress), "https://zidrun.com", "a trailing slash is normalised away");
});

withEnv({ AUTH_URL: "https://zidrun.com" }, () => {
  assert.equal(canonicalOrigin(bindAddress), "https://zidrun.com", "AUTH_URL is honoured when NEXTAUTH_URL is unset");
});

// Precedence, unified across the auth paths: the deliberate override, then Auth.js v5's own name,
// then the v4 name. These used to differ between the authorize hand-off and the email chrome, so a
// single password-reset email could carry a link to one host and a logo from another.
withEnv({ NEXT_PUBLIC_APP_URL: "https://app.example", AUTH_URL: "https://auth.example", NEXTAUTH_URL: "https://legacy.example" }, () => {
  assert.equal(canonicalOrigin(bindAddress), "https://app.example", "NEXT_PUBLIC_APP_URL is the top override");
  assert.equal(canonicalBaseUrl(bindAddress), "https://app.example");
});

withEnv({ AUTH_URL: "https://auth.example", NEXTAUTH_URL: "https://legacy.example" }, () => {
  assert.equal(canonicalOrigin(bindAddress), "https://auth.example", "AUTH_URL outranks the v4 name");
});

// canonicalBaseUrl keeps a configured sub-path; canonicalOrigin deliberately does not.
withEnv({ AUTH_URL: "https://zidrun.com/app/" }, () => {
  assert.equal(canonicalBaseUrl(bindAddress), "https://zidrun.com/app", "a sub-path survives, trailing slash does not");
  assert.equal(canonicalOrigin(bindAddress), "https://zidrun.com", "a redirect target is the origin only");
});

withEnv({}, () => {
  assert.equal(canonicalBaseUrl("http://127.0.0.1:3003/"), "http://127.0.0.1:3003", "the fallback is normalised too");
});

withEnv({}, () => {
  assert.equal(
    canonicalOrigin("http://127.0.0.1:3003"),
    "http://127.0.0.1:3003",
    "with neither set, development falls back to the request origin"
  );
});

withEnv({ NEXTAUTH_URL: "not a url" }, () => {
  assert.equal(
    canonicalOrigin("http://127.0.0.1:3003"),
    "http://127.0.0.1:3003",
    "a malformed value falls back rather than producing a URL pointing somewhere else"
  );
});

console.log("site URL: all checks passed");
