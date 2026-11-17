/**
 * Route segments (pauses) across every server-side route consumer. Pure, no database.
 *
 *   npm run test:route-segments
 *
 * The acceptance case comes from the 2026-11-17 M21 fake-GPS run: a manual pause during which the
 * phone moved ~100 m. The server bridged it with a straight line, adding the distance and counting
 * the paused 30 s as moving. With segment markers nothing may be measured or drawn across it.
 */
import assert from "node:assert/strict";
import type { RunRoutePoint } from "../src/components/coach/types";
import { computeBestEfforts } from "../src/lib/coach/best-efforts";
import { buildGpx, parseGpx } from "../src/lib/coach/gpx";
import { computeSplits, elevationSeries, paceSeries, smoothedElevationGainM } from "../src/lib/coach/run-stats";
import { decideDistance, legacyPausedSeconds, measureRoute } from "../src/lib/runs/distance-correction";
import { downsampleRoutePreservingSegments, isSegmentBreak, splitRouteSegments } from "../src/lib/runs/route-segments";

const LAT = 36.47;
const LNG = 2.83;
const M_PER_DEG_LAT = 111_195;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((LAT * Math.PI) / 180);
const T0 = 1_780_000_000_000; // 2026-05-28: GPX import refuses a start in the future

function at(seconds: number, east: number, segment?: number, ele?: number): RunRoutePoint {
  return {
    lat: LAT,
    lng: LNG + east / M_PER_DEG_LNG,
    t: T0 + seconds * 1000,
    ...(ele === undefined ? {} : { ele }),
    ...(segment === undefined ? {} : { segment }),
  };
}

/** [seconds] of running at [mps], one point a second, starting at (t0, east0). */
function stretch(t0: number, east0: number, seconds: number, mps: number, segment?: number, ele?: (i: number) => number): RunRoutePoint[] {
  const out: RunRoutePoint[] = [];
  for (let i = 0; i <= seconds; i += 1) out.push(at(t0 + i, east0 + i * mps, segment, ele?.(i)));
  return out;
}

/**
 * The acceptance case: 60 s at 10 km/h, a 30 s manual pause while the phone travels 100 m, 60 s
 * more. The recorder's pause-excluded duration is 120 s and it counted ~333 m.
 */
function pausedRun(marked: boolean): RunRoutePoint[] {
  const v = 10 / 3.6;
  const before = stretch(0, 0, 60, v, marked ? 0 : undefined);
  const resumeEast = 60 * v + 100;
  const after = stretch(90, resumeEast, 60, v, marked ? 1 : undefined);
  return [...before, ...after];
}
const DEVICE = { deviceKm: 0.333, deviceMovingSeconds: 120, durationSeconds: 120, source: "GPS", validity: "VALID", sport: "RUN" };

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("acceptance: a marked 30 s pause adds no distance and no moving time", () => {
  const m = measureRoute(pausedRun(true), "RUN", 120);
  assert.equal(m.pauseBreaks, 1);
  assert.ok(Math.abs(m.distanceM - 333) < 8, `route ${m.distanceM} m`);
  assert.ok(m.movingSeconds <= 120, `moving ${m.movingSeconds} s`);
  assert.equal(decideDistance(DEVICE, m).decision, "KEPT");
});

test("the same route under v1 rules would have been inflated (regression guard)", () => {
  // Without markers and without the run's duration, the gap is bridged: the bug as it was.
  const m = measureRoute(pausedRun(false), "RUN");
  assert.ok(m.distanceM > 420, `bridged ${m.distanceM} m`);
  assert.equal(decideDistance(DEVICE, m).decision, "APPLIED");
});

test("an unmarked stored route with a pause is not bridged once its duration is known", () => {
  const route = pausedRun(false);
  assert.ok(legacyPausedSeconds(route, 120) >= 25);
  const m = measureRoute(route, "RUN", 120);
  assert.equal(m.pauseBreaks, 1);
  assert.ok(Math.abs(m.distanceM - 333) < 8, `route ${m.distanceM} m`);
  assert.equal(decideDistance(DEVICE, m).decision, "KEPT");
});

test("an unmarked tunnel (signal loss, no pause) is still bridged and corrected", () => {
  // 120 s, a 45 s tunnel with no fixes, 60 s. Duration covers the tunnel: no pause to explain.
  const v = 10 / 3.6;
  const route = [...stretch(0, 0, 120, v), ...stretch(165, 165 * v, 60, v)];
  const duration = 230; // first fix came ~5 s after Start
  assert.equal(legacyPausedSeconds(route, duration), 0);
  const m = measureRoute(route, "RUN", duration);
  assert.equal(m.pauseBreaks, 0);
  assert.ok(m.distanceM > 225 * v * 0.97, `route ${m.distanceM} m`);
  const d = decideDistance({ ...DEVICE, deviceKm: 0.5, deviceMovingSeconds: 180, durationSeconds: duration }, m);
  assert.equal(d.decision, "APPLIED");
});

test("a marked route ignores the legacy duration heuristic", () => {
  // Marked, but no break inside a long tunnel: bridged as before.
  const v = 10 / 3.6;
  const route = [...stretch(0, 0, 120, v, 0), ...stretch(165, 165 * v, 60, v, 0)];
  assert.equal(legacyPausedSeconds(route, 100), 0);
  assert.equal(measureRoute(route, "RUN", 100).pauseBreaks, 0);
});

test("splits and pace series exclude a short pause entirely", () => {
  // Two 600 m stretches at 5:00/km separated by a 10 s pause (shorter than the 15 s moving-gap
  // rule, so only the marker keeps it out) during which the phone moved 80 m.
  const v = 1000 / 300;
  const a = stretch(0, 0, 180, v, 0);
  const b = stretch(190, 180 * v + 80, 180, v, 1);
  const splits = computeSplits([...a, ...b]);
  assert.equal(splits.length, 2);
  assert.equal(splits[0].meters, 1000);
  assert.ok(Math.abs(splits[0].paceSecondsPerKm - 300) <= 1, `pace ${splits[0].paceSecondsPerKm}`);
  const unmarked = computeSplits([...stretch(0, 0, 180, v), ...stretch(190, 180 * v + 80, 180, v)]);
  assert.ok(Math.abs(unmarked[0].paceSecondsPerKm - 300) > 2, "without markers the pause leaks into the split");
  const pace = paceSeries([...a, ...b]);
  assert.ok(pace.every((p) => Math.abs(p.value - 300) <= 2), JSON.stringify(pace));
});

test("elevation: a climb made while paused is not the runner's", () => {
  const a = stretch(0, 0, 120, 2.5, 0, () => 100);
  const b = stretch(300, 2000, 120, 2.5, 1, () => 140);
  assert.equal(smoothedElevationGainM([...a, ...b]), 0);
  // Unmarked, the same jump is counted as climb — the bug the marker fixes.
  assert.ok(smoothedElevationGainM([...a, ...b].map((p) => ({ ...p, segment: undefined }))) >= 30);
  // The profile does not advance across the pause.
  const series = elevationSeries([...a, ...b]);
  const last = series[series.length - 1];
  assert.ok(Math.abs(last.distanceKm - 0.6) < 0.01, `profile ends at ${last.distanceKm} km`);
});

test("best efforts never span a pause", () => {
  const v = 1000 / 240;
  const a = stretch(0, 0, 150, v, 0); // 625 m
  const b = stretch(155, 150 * v + 30, 150, v, 1); // 625 m after a 5 s pause
  assert.equal(computeBestEfforts([...a, ...b]).length, 0);
  const unmarked = [...stretch(0, 0, 150, v), ...stretch(155, 150 * v + 30, 150, v)];
  assert.equal(computeBestEfforts(unmarked).length, 1, "without markers the 5 s gap is joined");
});

test("GPX export writes one <trkseg> per segment and imports back the same breaks", () => {
  const route = pausedRun(true);
  const xml = buildGpx({ name: "Paused", startedAt: new Date(T0), route });
  assert.equal(xml.match(/<trkseg>/g)?.length, 2);
  const parsed = parseGpx(xml);
  assert.equal(splitRouteSegments(parsed.route).length, 2);
  assert.ok(Math.abs(parsed.distanceKm - 0.33) <= 0.01, `imported ${parsed.distanceKm} km`);
  // A plain single-segment file stays unmarked.
  const plain = parseGpx(buildGpx({ name: "Plain", startedAt: new Date(T0), route: stretch(0, 0, 120, 3) }));
  assert.ok(plain.route.every((p) => p.segment === undefined));
});

test("thinning keeps both sides of every break, and the first and last point", () => {
  const v = 3;
  const route = [...stretch(0, 0, 400, v, 0), ...stretch(430, 1300, 400, v, 1), ...stretch(900, 2600, 400, v, 3)];
  const thin = downsampleRoutePreservingSegments(route, 64);
  assert.ok(thin.length <= 64 + 4);
  assert.equal(thin[0], route[0]);
  assert.equal(thin[thin.length - 1], route[route.length - 1]);
  const breaksIn = (pts: RunRoutePoint[]) => pts.filter((p, i) => i > 0 && isSegmentBreak(pts[i - 1], p)).length;
  assert.equal(breaksIn(thin), 2);
  for (let i = 1; i < route.length; i += 1) {
    if (isSegmentBreak(route[i - 1], route[i])) {
      assert.ok(thin.includes(route[i - 1]) && thin.includes(route[i]), `break at ${i} kept`);
    }
  }
});

console.log(`\n${passed} route-segment checks passed`);
