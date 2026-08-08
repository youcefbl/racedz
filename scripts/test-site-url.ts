import assert from "node:assert/strict";
import { canonicalOrigin } from "../src/lib/site-url";

/*
 * Regression guard for the production browser sign-in failure: /api/v1/auth/authorize built its
 * login hand-off from the incoming request's origin, which behind the reverse proxy is the address
 * Next binds to. Signed-out runners on the native app were sent to https://0.0.0.0:3003/login and
 * got a connection error. NextAuth had the correct origin on the same response.
 */

const saved = { NEXTAUTH_URL: process.env.NEXTAUTH_URL, AUTH_URL: process.env.AUTH_URL };
function withEnv(env: { NEXTAUTH_URL?: string; AUTH_URL?: string }, run: () => void) {
  delete process.env.NEXTAUTH_URL;
  delete process.env.AUTH_URL;
  if (env.NEXTAUTH_URL) process.env.NEXTAUTH_URL = env.NEXTAUTH_URL;
  if (env.AUTH_URL) process.env.AUTH_URL = env.AUTH_URL;
  try {
    run();
  } finally {
    delete process.env.NEXTAUTH_URL;
    delete process.env.AUTH_URL;
    if (saved.NEXTAUTH_URL) process.env.NEXTAUTH_URL = saved.NEXTAUTH_URL;
    if (saved.AUTH_URL) process.env.AUTH_URL = saved.AUTH_URL;
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

withEnv({ NEXTAUTH_URL: "https://zidrun.com", AUTH_URL: "https://wrong.example" }, () => {
  assert.equal(canonicalOrigin(bindAddress), "https://zidrun.com", "NEXTAUTH_URL wins, matching the rest of the app");
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

console.log("site URL: 7/7 checks passed");
