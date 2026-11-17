/**
 * Sport-specific plausibility (src/lib/coach/motion-check.ts classifyActivity). Pure, no database.
 *
 *   npm run test:activity-check
 */
import assert from "node:assert/strict";
import { classifyActivity } from "../src/lib/coach/motion-check";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
/** km at km/h over a moving time long enough to be judged. */
const at = (kmh: number, minutes = 10) => ({ distanceKm: (kmh * minutes) / 60, movingSeconds: minutes * 60 });

test("the 2026-11-17 M21 case: an 18 km/h walk is SUSPECT, not a valid walk", () => {
  assert.deepEqual(classifyActivity({ sport: "WALK", ...at(18), avgCadence: null }), { validity: "SUSPECT", reason: "TOO_FAST_FOR_WALK" });
});

test("ordinary and brisk walks, and a race-walk-ish 9 km/h, stay valid", () => {
  for (const kmh of [4, 5.5, 7, 9]) assert.equal(classifyActivity({ sport: "WALK", ...at(kmh) }), null, `${kmh} km/h`);
});

test("the same 18 km/h is a perfectly good run or trail run", () => {
  assert.equal(classifyActivity({ sport: "RUN", ...at(18), avgCadence: 175 }), null);
  assert.equal(classifyActivity({ sport: "TRAIL", ...at(18), avgCadence: 175 }), null);
});

test("a car is excluded whatever foot sport it was labelled", () => {
  for (const sport of ["RUN", "WALK", "TRAIL"] as const) {
    assert.deepEqual(classifyActivity({ sport, ...at(45) }), { validity: "EXCLUDED", reason: "IMPOSSIBLE_PACE" }, sport);
  }
});

test("a run at speed with a bike's cadence is suspect", () => {
  assert.deepEqual(classifyActivity({ sport: "RUN", ...at(15), avgCadence: 60 }), { validity: "SUSPECT", reason: "LOW_CADENCE_AT_SPEED" });
});

test("rides: 25 and 45 km/h averages are fine, a motorway average is not", () => {
  assert.equal(classifyActivity({ sport: "RIDE", ...at(25), avgCadence: 10 }), null);
  assert.equal(classifyActivity({ sport: "RIDE", ...at(45) }), null);
  assert.deepEqual(classifyActivity({ sport: "RIDE", ...at(80) }), { validity: "SUSPECT", reason: "RIDE_TOO_FAST" });
});

test("too little to judge is never judged", () => {
  assert.equal(classifyActivity({ sport: "WALK", distanceKm: 0.4, movingSeconds: 60 }), null);
});

console.log(`\n${passed} activity-check checks passed`);
