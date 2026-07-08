// Log every seeded user into the staging app via the next-auth (Auth.js v5)
// credentials flow and capture their session cookie, writing k6/data/users.json
// as [{ email, cookie }].
//
// Why pre-harvest instead of logging in inside k6:
//   Each login runs bcrypt.compare on the server. 1000 concurrent logins during
//   the ramp would themselves saturate the box and distort results. We do the
//   logins once, throttled, then k6 just replays the cookies.
//
// Run from the repo root AFTER seeding, pointed at staging:
//   BASE_URL=https://stg.zidrun.com node loadtest/seed/harvest-cookies.mjs
//
// Cloudflare note: to harvest against the ORIGIN (bypassing CF) set
//   NODE_TLS_REJECT_UNAUTHORIZED=0 and BASE_URL=https://<origin-ip>, adding a
//   Host header is not needed here — simplest is to run harvest through CF
//   (whitelist this host's IP in a CF WAF rule) and reuse the cookies for the
//   origin-direct k6 run; session cookies are host-scoped but Auth.js sets them
//   for the apex/subdomain, so they work for both paths on stg.zidrun.com.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COUNT, PASSWORD, emailFor } from "./users-spec.mjs";

const BASE = (process.env.BASE_URL || "https://stg.zidrun.com").replace(/\/$/, "");
const CONCURRENCY = Number(process.env.HARVEST_CONCURRENCY || 20);
const OUT =
  process.env.OUT ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "k6", "data", "users.json");

function readSetCookie(res) {
  // undici (Node 18.14+) exposes getSetCookie(); fall back to the single header.
  if (typeof res.headers.getSetCookie === "function") return res.headers.getSetCookie();
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function applyCookies(setCookies, jar) {
  for (const c of setCookies) {
    const pair = c.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (val === "" || val === "deleted") delete jar[name];
    else jar[name] = val;
  }
  return jar;
}

const cookieHeader = (jar) =>
  Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

async function login(email) {
  const jar = {};
  // 1) Get a CSRF token + cookie.
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  applyCookies(readSetCookie(csrfRes), jar);
  const { csrfToken } = await csrfRes.json();

  // 2) Post credentials; capture the session cookie from the redirect response.
  const body = new URLSearchParams({
    csrfToken,
    email,
    password: PASSWORD,
    callbackUrl: BASE,
    json: "true"
  });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(jar) },
    body
  });
  applyCookies(readSetCookie(res), jar);

  const hasSession = Object.keys(jar).some((n) => n.includes("session-token"));
  if (!hasSession) throw new Error(`no session cookie (HTTP ${res.status})`);
  return cookieHeader(jar);
}

async function run() {
  const emails = Array.from({ length: COUNT }, (_, i) => emailFor(i + 1));
  const users = [];
  let idx = 0;
  let done = 0;
  let failed = 0;

  async function worker() {
    while (idx < emails.length) {
      const email = emails[idx++];
      try {
        users.push({ email, cookie: await login(email) });
      } catch (e) {
        failed++;
        if (failed <= 5) console.error(`  login failed ${email}: ${e.message}`);
      }
      if (++done % 50 === 0) console.log(`  ${done}/${emails.length} (failed ${failed})`);
    }
  }

  console.log(`Harvesting ${COUNT} sessions from ${BASE} (concurrency ${CONCURRENCY})`);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(users));
  console.log(`\nWrote ${users.length} cookies -> ${OUT} (failed ${failed})`);
  if (users.length === 0) process.exitCode = 1;
}

run();
