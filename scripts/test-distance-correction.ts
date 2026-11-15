/**
 * Pure checks for src/lib/runs/distance-correction.ts and the scrub/fingerprint helpers in
 * src/lib/runs/telemetry.ts. No database.
 *
 *   npm run test:distance-correction
 */
import assert from "node:assert/strict";
import { decideDistance, measureRoute, type RoutePoint } from "../src/lib/runs/distance-correction";
import { diagnosticFingerprint, scrubFacts } from "../src/lib/runs/telemetry";

const LAT = 36.0;
const LNG = 3.0;
const M_PER_DEG_LAT = 111_195;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((LAT * Math.PI) / 180);

function point(seconds: number, east: number, north: number): RoutePoint {
  return { lat: LAT + north / M_PER_DEG_LAT, lng: LNG + east / M_PER_DEG_LNG, t: 1_800_000_000_000 + seconds * 1000 };
}

/** Deterministic pseudo-random noise. */
function noise(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648 - 0.5;
  };
}

const facts = { deviceMovingSeconds: 0, durationSeconds: 2000, source: "GPS", validity: "VALID", sport: "WALK" };
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("a sparse slow-walk route (the 2026-11-14 shape) measures its length", () => {
  // Points every 20–150 s at ~0.7 m/s, as the pre-fix phone stored them.
  const route: RoutePoint[] = [];
  let t = 0;
  let east = 0;
  const gaps = [20, 80, 40, 150, 30, 60, 25, 90];
  for (let i = 0; i < 60; i++) {
    route.push(point(t, east, 0));
    const dt = gaps[i % gaps.length];
    t += dt;
    east += dt * 0.7;
  }
  const m = measureRoute(route, "WALK");
  const expected = route.length > 0 ? east - gaps[59 % gaps.length] * 0.7 : 0;
  assert.ok(Math.abs(m.distanceM - expected) < expected * 0.01, `${m.distanceM} vs ${expected}`);
  assert.ok(m.movingSeconds > 0.95 * ((route.at(-1)!.t! - route[0].t!) / 1000));
  assert.equal(m.confidence, 1);

  const decision = decideDistance({ ...facts, deviceKm: 0.167 }, m);
  assert.equal(decision.decision, "APPLIED");
  if (decision.decision === "APPLIED") {
    assert.ok(Math.abs(decision.appliedKm - expected / 1000) < 0.02);
    assert.ok(decision.movingSeconds > 1000);
  }
});

test("a dense jittery jog route is not inflated", () => {
  const rnd = noise(7);
  const route = Array.from({ length: 601 }, (_, s) => point(s, 3 * s + rnd() * 2, rnd() * 2));
  const m = measureRoute(route, "RUN");
  assert.ok(Math.abs(m.distanceM - 1800) < 1800 * 0.04, `${m.distanceM}`);
  // Phone and route agree: nothing changes.
  assert.equal(decideDistance({ ...facts, sport: "RUN", deviceKm: 1.81 }, m).decision, "KEPT");
});

test("a teleport point is ignored", () => {
  const route = Array.from({ length: 121 }, (_, s) => point(s, 2 * s, 0));
  route[60] = point(60, 120, 900);
  const m = measureRoute(route, "RUN");
  assert.ok(Math.abs(m.distanceM - 240) < 5, `${m.distanceM}`);
  assert.equal(m.rejectedPoints, 1);
});

test("a long gap is not bridged", () => {
  const before = Array.from({ length: 61 }, (_, s) => point(s, 2 * s, 0));
  const after = Array.from({ length: 61 }, (_, s) => point(1000 + s, 2000 + 2 * s, 0));
  const m = measureRoute([...before, ...after], "RUN");
  assert.ok(Math.abs(m.distanceM - 240) < 5, `${m.distanceM}`);
  assert.equal(m.longGaps, 1);
  assert.ok(m.confidence < 1);
});

test("a phone longer than its route is flagged, never shortened automatically", () => {
  const route = Array.from({ length: 301 }, (_, s) => point(s, 3 * s, 0));
  const m = measureRoute(route, "RUN");
  assert.equal(decideDistance({ ...facts, sport: "RUN", deviceKm: 1.5 }, m).decision, "FLAGGED");
});

test("manual, imported and non-valid runs are skipped", () => {
  const route = Array.from({ length: 301 }, (_, s) => point(s, 3 * s, 0));
  const m = measureRoute(route, "RUN");
  assert.equal(decideDistance({ ...facts, source: "MANUAL", deviceKm: 0.1 }, m).decision, "SKIPPED");
  assert.equal(decideDistance({ ...facts, source: "IMPORTED", deviceKm: 0.1 }, m).decision, "SKIPPED");
  assert.equal(decideDistance({ ...facts, validity: "SUSPECT", deviceKm: 0.1 }, m).decision, "SKIPPED");
});

test("a correction that would make a walk faster than a foot can go is flagged", () => {
  // 5 km in 5 minutes of moving time.
  const route = Array.from({ length: 301 }, (_, s) => point(s, 11 * s, 0));
  const m = measureRoute(route, "RUN");
  const decision = decideDistance({ ...facts, sport: "RUN", deviceKm: 1, durationSeconds: 300 }, m);
  assert.equal(decision.decision, "FLAGGED");
});

test("a route that moves like a car is flagged, not used to correct", () => {
  // 10 m/s for most of it (an emulator replay or a drive), labelled RUN, phone under-counted.
  const route = Array.from({ length: 601 }, (_, s) => point(s, (s < 100 ? 3 : 10) * s, 0));
  const m = measureRoute(route, "RUN");
  assert.ok(m.speedP90Mps > 7);
  assert.equal(decideDistance({ ...facts, sport: "RUN", deviceKm: 1, durationSeconds: 600 }, m).decision, "FLAGGED");
});

test("untimed or tiny routes are not trusted", () => {
  const untimed = Array.from({ length: 50 }, (_, s) => ({ ...point(s, 3 * s, 0), t: null }));
  assert.equal(decideDistance({ ...facts, deviceKm: 0.01 }, measureRoute(untimed, "RUN")).decision, "SKIPPED");
  const tiny = Array.from({ length: 5 }, (_, s) => point(s, 3 * s, 0));
  assert.equal(decideDistance({ ...facts, deviceKm: 0.001 }, measureRoute(tiny, "RUN")).decision, "SKIPPED");
});

test("scrubFacts drops location and credential keys at any depth", () => {
  const scrubbed = scrubFacts({ model: "X", lat: 1, nested: { longitude: 2, token: "t", ok: true }, list: [{ email: "a@b" }] }) as Record<string, unknown>;
  assert.deepEqual(scrubbed, { model: "X", nested: { ok: true }, list: [{}] });
});

test("fingerprints ignore line numbers and group the same crash", () => {
  const a = "java.lang.IllegalStateException: boom\n\tat dz.racedz.A.run(A.kt:10)\n\tat dz.racedz.B.go(B.kt:20)";
  const b = "java.lang.IllegalStateException: other message\n\tat dz.racedz.A.run(A.kt:12)\n\tat dz.racedz.B.go(B.kt:25)";
  const c = "java.lang.NullPointerException\n\tat dz.racedz.A.run(A.kt:10)";
  assert.equal(diagnosticFingerprint("crash", a), diagnosticFingerprint("crash", b));
  assert.notEqual(diagnosticFingerprint("crash", a), diagnosticFingerprint("crash", c));
});

console.log(`\n${passed} distance-correction checks passed`);
