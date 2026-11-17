import assert from "node:assert/strict";
import type { RunRoutePoint } from "../src/components/coach/types";
import { computeSplits, elevationSeries, paceSeries, smoothedElevationGainM, smoothedElevationLossM } from "../src/lib/coach/run-stats";

const METERS_PER_LAT_DEGREE = 111_195;

function mixedWalkRunWalkRoute(): RunRoutePoint[] {
  const points: RunRoutePoint[] = [{ lat: 0, lng: 0, ele: 0, t: 0 }];
  let meters = 0;
  let timeMs = 0;
  const addKilometer = (paceSecondsPerKm: number) => {
    for (let i = 0; i < 100; i += 1) {
      meters += 10;
      timeMs += paceSecondsPerKm * 10;
      points.push({ lat: meters / METERS_PER_LAT_DEGREE, lng: 0, ele: 0, t: timeMs });
    }
  };

  addKilometer(900); // 15:00/km walk
  timeMs += 10 * 60_000;
  points.push({ ...points[points.length - 1], t: timeMs }); // stationary/manual-pause gap
  addKilometer(360); // 6:00/km run
  addKilometer(900); // 15:00/km walk
  return points;
}

const route = mixedWalkRunWalkRoute();
const splits = computeSplits(route);
assert.equal(splits.length, 3);
assert.ok(Math.abs(splits[0].paceSecondsPerKm - 900) <= 2, "first walking split stays near 15:00/km");
assert.ok(Math.abs(splits[1].paceSecondsPerKm - 360) <= 2, "middle running split stays near 6:00/km");
assert.ok(Math.abs(splits[2].paceSecondsPerKm - 900) <= 2, "last walking split stays near 15:00/km");
assert.ok(splits.every((split) => split.seconds < 1_000), "the pause/GPS gap is excluded from moving splits");

const pace = paceSeries(route, 250);
assert.ok(pace.length >= 10);
const fastest = Math.min(...pace.map((point) => point.value));
const slowest = Math.max(...pace.map((point) => point.value));
assert.ok(fastest < 400, "the running section remains visible in the pace profile");
assert.ok(slowest > 850 && slowest < 950, "walking remains visible without including the pause gap");

const elevationSpike: RunRoutePoint[] = [0, 0, 0, 50, 0, 0, 0].map((ele, index) => ({
  lat: index / METERS_PER_LAT_DEGREE,
  lng: 0,
  ele,
  t: index * 1_000
}));
assert.deepEqual(
  elevationSeries(elevationSpike).map((point) => point.value),
  [0, 0, 0, 0, 0, 0, 0],
  "an isolated altitude spike is removed from the displayed profile"
);

// Loss is measured like gain: up 30 m and back down reads 30 / 30, not two different methods.
const hill: RunRoutePoint[] = Array.from({ length: 121 }, (_, index) => ({
  lat: (index * 5) / METERS_PER_LAT_DEGREE,
  lng: 0,
  ele: 100 + 30 * Math.sin((Math.PI * index) / 120),
  t: index * 2_000
}));
assert.equal(smoothedElevationGainM(hill), smoothedElevationLossM(hill), "a symmetric hill climbs and descends equally");
assert.ok(Math.abs(smoothedElevationLossM(hill) - 30) <= 6, `loss ${smoothedElevationLossM(hill)}`);

// The pace chart's window scales with the run: a 1 km run gets ~20 points, not 4.
const oneKm: RunRoutePoint[] = Array.from({ length: 301 }, (_, index) => ({
  lat: ((index * 1000) / 300) / METERS_PER_LAT_DEGREE,
  lng: 0,
  t: index * 1_200
}));
assert.ok(paceSeries(oneKm).length >= 15, `1 km pace points: ${paceSeries(oneKm).length}`);
assert.ok(paceSeries(oneKm, 250).length <= 4, "an explicit window is still honoured");

console.log("Run split, pace-profile, pause-gap, and elevation-profile checks passed.");
