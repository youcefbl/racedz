import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import exec from "k6/execution";
import {
  BASE_URL,
  buildScenarios,
  thresholds,
  hosts,
  RUN_WITH_ROUTE,
  RACE_ID,
  RACE_CATEGORY_ID
} from "./lib/config.js";
import { userFor } from "./lib/users.js";

export const options = {
  scenarios: buildScenarios(),
  thresholds,
  hosts, // undefined unless ORIGIN_IP set (Cloudflare-bypass / origin-direct run)
  insecureSkipTLSVerify: true, // tolerate origin-direct TLS when hitting an IP
  discardResponseBodies: true // we only assert on status/timings -> less client RAM
};

// Dedicated trend for the run-record write, so its latency is visible separately.
const runPost = new Trend("run_post_duration", true);

// --- helpers -----------------------------------------------------------------
function think(min, max) {
  sleep(min + Math.random() * (max - min));
}
const authParams = (user) => ({ headers: { cookie: user.cookie } });
const jsonAuth = (user) => ({ headers: { cookie: user.cookie, "content-type": "application/json" } });

function beacon(pathViewed, platform) {
  // Mirrors the client PageView tracker: navigator.sendBeacon to /api/track on
  // every route change. Public, fire-and-forget.
  http.post(
    `${BASE_URL}/api/track`,
    JSON.stringify({ path: pathViewed, locale: "en", platform }),
    { headers: { "content-type": "application/json" } }
  );
}

function buildRun() {
  const distanceKm = Number((3 + Math.random() * 12).toFixed(2));
  const paceSecPerKm = 300 + Math.floor(Math.random() * 120); // 5:00–7:00 /km
  const durationSeconds = Math.round(distanceKm * paceSecPerKm);
  const body = {
    startedAt: new Date(Date.now() - durationSeconds * 1000).toISOString(),
    distanceKm,
    durationSeconds,
    perceivedEffort: 1 + Math.floor(Math.random() * 10),
    fatigueLevel: Math.floor(Math.random() * 6),
    painLevel: 0,
    source: RUN_WITH_ROUTE ? "GPS" : "MANUAL",
    title: "Load test run"
  };
  if (RUN_WITH_ROUTE) {
    // ~200 GPS points around Algiers to simulate a real recorded-run payload.
    const pts = [];
    let lat = 36.75;
    let lng = 3.06;
    for (let t = 0; t < 200; t++) {
      lat += (Math.random() - 0.5) * 0.0008;
      lng += (Math.random() - 0.5) * 0.0008;
      pts.push({ lat, lng, ele: 20 + Math.random() * 30, t: t * Math.round(durationSeconds / 200) });
    }
    body.route = pts;
  }
  return body;
}

// --- scenarios ---------------------------------------------------------------

// 60%: unauthenticated navigation (web + mobile), the dominant traffic.
export function browse() {
  const platform = Math.random() < 0.5 ? "android" : "web";

  check(http.get(`${BASE_URL}/`), { "home 2xx": (r) => r.status === 200 });
  beacon("/", platform);
  think(3, 8);

  check(http.get(`${BASE_URL}/api/races`), { "races list 2xx": (r) => r.status === 200 });
  beacon("/races", platform);
  think(4, 10);

  http.get(`${BASE_URL}/faq`);
  beacon("/faq", platform);
  think(2, 6);
}

// 25%: the run-recording critical path (authenticated, write-heavy).
export function record() {
  const user = userFor(exec.vu.idInTest);

  check(http.get(`${BASE_URL}/api/coach/runs?limit=20`, authParams(user)), {
    "runs list 2xx": (r) => r.status === 200
  });
  think(2, 5);

  const res = http.post(`${BASE_URL}/api/coach/runs`, JSON.stringify(buildRun()), jsonAuth(user));
  runPost.add(res.timings.duration);
  // 429 = per-user rate limit (30/min) — expected under aggressive settings, not a failure.
  check(res, { "run created (201/429)": (r) => r.status === 201 || r.status === 429 });
  think(15, 40); // a real run is many minutes; compressed think-time here

  if (Math.random() < 0.3) http.get(`${BASE_URL}/api/coach`, authParams(user));
  think(5, 15);
}

// 15%: engaged authenticated user — read paths + occasional register write.
export function active() {
  const user = userFor(exec.vu.idInTest);

  check(http.get(`${BASE_URL}/api/me/registrations`, authParams(user)), {
    "registrations 2xx": (r) => r.status === 200
  });
  think(3, 8);

  http.get(`${BASE_URL}/api/me/appearance`, authParams(user));
  think(2, 5);

  if (RACE_ID) {
    http.get(`${BASE_URL}/api/races/${RACE_ID}`, authParams(user));
    think(3, 6);

    // Optional real registration write. Body fields are best-effort — adjust to
    // your raceRegistrationSchema if the app rejects them (400/422 tolerated).
    if (RACE_CATEGORY_ID && Math.random() < 0.2) {
      const reg = {
        raceCategoryId: RACE_CATEGORY_ID,
        firstName: "Load",
        lastName: "Test",
        phone: "0550000000",
        gender: "MALE",
        dateOfBirth: "1995-01-01",
        wilaya: "Alger",
        city: "Alger",
        emergencyContactName: "Emergency",
        emergencyContactPhone: "0550000001"
      };
      const res = http.post(`${BASE_URL}/api/races/${RACE_ID}/register`, JSON.stringify(reg), jsonAuth(user));
      check(res, {
        // 409 = already registered, 429 = rate-limited — all "handled".
        "register handled": (r) => [201, 400, 409, 422, 429].includes(r.status)
      });
    }
  }
  think(5, 12);
}
