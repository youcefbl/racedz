// Central knobs for the load test. Everything is env-driven so you never edit
// code to change a run:
//
//   BASE_URL   target, default https://stg.zidrun.com
//   PROFILE    smoke | load | stress | soak | spike   (default load)
//   TARGET     peak concurrent virtual users at 100%   (default 1000)
//   ORIGIN_IP  if set, resolve BASE_URL's host to this IP -> bypass Cloudflare
//              (this is the "origin-direct" run that measures YOUR stack)
//   RUN_WITH_ROUTE  "true" to attach a ~200-point GPS route to each run POST
//                   (heavier, realistic GPS payload). Default MANUAL/light.
//   RACE_ID / RACE_CATEGORY_ID  optional: enables race-detail + register calls
//                               in the active-user scenario.

export const BASE_URL = (__ENV.BASE_URL || "https://stg.zidrun.com").replace(/\/$/, "");
export const PROFILE = __ENV.PROFILE || "load";
export const TARGET = Number(__ENV.TARGET || 1000);
export const RUN_WITH_ROUTE = (__ENV.RUN_WITH_ROUTE || "false") === "true";
export const RACE_ID = __ENV.RACE_ID || "";
export const RACE_CATEGORY_ID = __ENV.RACE_CATEGORY_ID || "";

// Behaviour mix — realistic split of 1000 concurrent users. Browsing dominates
// (web + mobile navigation with think-time); run recording is the write-heavy
// critical path; active users hit authenticated read paths + occasional writes.
const SHARES = { browse: 0.6, record: 0.25, active: 0.15 };

const hostname = BASE_URL.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
export const hosts = __ENV.ORIGIN_IP ? { [hostname]: __ENV.ORIGIN_IP } : undefined;

// Stage shape per profile, scaled to a scenario's peak VU count.
function shape(peak) {
  const half = Math.max(1, Math.round(peak * 1.5));
  const dbl = Math.max(1, peak * 2);
  switch (PROFILE) {
    case "smoke": // quick sanity — run with a small TARGET, e.g. TARGET=10
      return [
        { duration: "20s", target: peak },
        { duration: "40s", target: peak },
        { duration: "10s", target: 0 }
      ];
    case "stress": // push past target until it breaks; finds the real ceiling
      return [
        { duration: "3m", target: peak },
        { duration: "5m", target: peak },
        { duration: "3m", target: half },
        { duration: "5m", target: half },
        { duration: "3m", target: dbl },
        { duration: "5m", target: dbl },
        { duration: "2m", target: 0 }
      ];
    case "soak": // hold target for 2h — leaks, connection exhaustion, disk fill
      return [
        { duration: "5m", target: peak },
        { duration: "120m", target: peak },
        { duration: "3m", target: 0 }
      ];
    case "spike": // sudden rush (e.g. race registration opens)
      return [
        { duration: "30s", target: Math.max(1, Math.round(peak * 0.1)) },
        { duration: "30s", target: peak },
        { duration: "3m", target: peak },
        { duration: "1m", target: 0 }
      ];
    case "load": // the target-proving run: ramp to peak, hold 20m
    default:
      return [
        { duration: "5m", target: peak },
        { duration: "20m", target: peak },
        { duration: "2m", target: 0 }
      ];
  }
}

function scenario(exec, share) {
  return {
    executor: "ramping-vus",
    exec,
    startVUs: 0,
    stages: shape(Math.max(1, Math.round(TARGET * share))),
    gracefulRampDown: "30s",
    tags: { scenario: exec }
  };
}

export function buildScenarios() {
  return {
    browse: scenario("browse", SHARES.browse),
    record: scenario("record", SHARES.record),
    active: scenario("active", SHARES.active)
  };
}

// Pass/fail SLOs. The run fails (non-zero exit) if any threshold is breached.
export const thresholds = {
  http_req_failed: ["rate<0.01"], // < 1% errors
  http_req_duration: ["p(95)<800", "p(99)<2000"],
  "http_req_duration{scenario:record}": ["p(95)<1500"], // write path is allowed a bit more
  run_post_duration: ["p(95)<1000"], // the run-record write itself
  checks: ["rate>0.99"]
};
