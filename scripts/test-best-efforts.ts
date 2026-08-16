import assert from "node:assert/strict";
import type { RunRoutePoint } from "../src/components/coach/types";
import { computeBestEfforts } from "../src/lib/coach/best-efforts";

// Deterministic checks for the best-effort algorithm (NATRUN-06.3). Routes are synthetic
// straight lines along a meridian, one point every 10 m, so distances are exact to the metre.
const METERS_PER_LAT_DEGREE = 111_195;

type Builder = { points: RunRoutePoint[]; meters: number; timeMs: number };
function start(): Builder {
  return { points: [{ lat: 0, lng: 0, ele: 0, t: 0 }], meters: 0, timeMs: 0 };
}
function add(b: Builder, meters: number, paceSecondsPerKm: number, stepM = 10) {
  for (let m = 0; m < meters; m += stepM) {
    b.meters += stepM;
    b.timeMs += paceSecondsPerKm * stepM;
    b.points.push({ lat: b.meters / METERS_PER_LAT_DEGREE, lng: 0, ele: 0, t: b.timeMs });
  }
}
function pause(b: Builder, seconds: number) {
  b.timeMs += seconds * 1000;
  b.points.push({ ...b.points[b.points.length - 1], t: b.timeMs });
}
const secondsOf = (efforts: ReturnType<typeof computeBestEfforts>, d: number) =>
  efforts.find((e) => e.distanceM === d)?.seconds;

// 1. A steady 12 km at 5:00/km: every target exists and reads 5:00/km.
{
  const b = start();
  add(b, 12_000, 300);
  const efforts = computeBestEfforts(b.points);
  assert.equal(efforts.length, 3);
  assert.ok(Math.abs(secondsOf(efforts, 1000)! - 300) < 1, "1 km ≈ 5:00");
  assert.ok(Math.abs(secondsOf(efforts, 5000)! - 1500) < 1, "5 km ≈ 25:00");
  assert.ok(Math.abs(secondsOf(efforts, 10_000)! - 3000) < 1, "10 km ≈ 50:00");
}

// 2. Runs shorter than a target have no effort for it; a 5.02 km run still has a 5 km effort.
{
  const b = start();
  add(b, 5_020, 330);
  const efforts = computeBestEfforts(b.points);
  assert.deepEqual(efforts.map((e) => e.distanceM), [1000, 5000]);
  assert.ok(Math.abs(secondsOf(efforts, 5000)! - 1650) < 1, "5 km inside a 5.02 km run is measured to the metre");
}

// 3. The fastest window is found wherever it lies: 2 km easy, 1 km at 4:00, 2 km easy.
{
  const b = start();
  add(b, 2_000, 360);
  add(b, 1_000, 240);
  add(b, 2_000, 360);
  const efforts = computeBestEfforts(b.points);
  assert.ok(Math.abs(secondsOf(efforts, 1000)! - 240) < 1, "best 1 km is the 4:00 kilometre");
  // Best 5 km is the whole run: 4 km at 6:00 + 1 km at 4:00 = 1680 s.
  assert.ok(Math.abs(secondsOf(efforts, 5000)! - 1680) < 1);
}

// 4. A pause (gap ≥ 15 s) splits the route: no effort spans it, and the paused time is never counted.
{
  const b = start();
  add(b, 3_000, 300);
  pause(b, 120);
  add(b, 3_000, 300);
  const efforts = computeBestEfforts(b.points);
  assert.equal(secondsOf(efforts, 5000), undefined, "no 5 km window is allowed to bridge the pause");
  assert.ok(Math.abs(secondsOf(efforts, 1000)! - 300) < 1);
}

// 5. A GPS teleport (one 500 m jump) cuts the route rather than producing a superhuman effort.
{
  const b = start();
  add(b, 2_000, 300);
  b.meters += 500;
  b.timeMs += 1_000;
  b.points.push({ lat: b.meters / METERS_PER_LAT_DEGREE, lng: 0, ele: 0, t: b.timeMs });
  add(b, 2_000, 300);
  const efforts = computeBestEfforts(b.points);
  assert.ok(Math.abs(secondsOf(efforts, 1000)! - 300) < 1, "the jump does not create a fast kilometre");
  assert.equal(secondsOf(efforts, 5000), undefined);
}

// 6. Without timestamps nothing is reported — never inferred from average pace.
{
  const b = start();
  add(b, 6_000, 300);
  const stripped = b.points.map((p) => ({ lat: p.lat, lng: p.lng, ele: p.ele }));
  assert.deepEqual(computeBestEfforts(stripped as RunRoutePoint[]), []);
  assert.deepEqual(computeBestEfforts(null), []);
  assert.deepEqual(computeBestEfforts([]), []);
}

// 7. Sparse but honest sampling (one point every 100 m at 1 Hz-ish gaps < 15 s) still measures.
{
  const b = start();
  add(b, 5_000, 120 /* 2:00/km → 12 s per 100 m */, 100);
  const efforts = computeBestEfforts(b.points);
  // 2:00/km is exactly the plausibility floor; 1:59 would be dropped. Both targets present.
  assert.ok(efforts.length >= 2);
}

// 8. Beyond-human windows are dropped rather than reported.
{
  const b = start();
  add(b, 3_000, 90); // 1:30/km
  assert.deepEqual(computeBestEfforts(b.points), []);
}

console.log("best-efforts OK");
