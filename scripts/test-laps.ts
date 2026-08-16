import assert from "node:assert/strict";
import { deriveLaps, validateLapBoundaries } from "../src/lib/coach/laps";

// Manual laps (NATRUN-06.5): the shared derive/validate helper both the API and tests rely on.

// Valid, well-spaced boundaries derive three laps plus the tail to the finish.
{
  const laps = [
    { atMeters: 1200, atSeconds: 391 },
    { atMeters: 2000, atSeconds: 633 },
    { atMeters: 3650, atSeconds: 1184 },
  ];
  assert.equal(validateLapBoundaries(laps, 5000, 1700), null);
  const derived = deriveLaps(laps, 5000, 1700);
  assert.equal(derived.length, 4);
  assert.deepEqual(derived[0], { index: 1, meters: 1200, seconds: 391, paceSecondsPerKm: 326 });
  assert.deepEqual(derived[1], { index: 2, meters: 800, seconds: 242, paceSecondsPerKm: 303 });
  assert.deepEqual(derived[3], { index: 4, meters: 1350, seconds: 516, paceSecondsPerKm: 382 });
}

// The tail is dropped when Finish came right after the last press.
{
  const laps = [{ atMeters: 1000, atSeconds: 300 }];
  const derived = deriveLaps(laps, 1002, 302);
  assert.equal(derived.length, 1);
}

// Refusals: not increasing, too close, beyond the totals, too many.
{
  assert.ok(validateLapBoundaries([{ atMeters: 500, atSeconds: 150 }, { atMeters: 400, atSeconds: 200 }], 5000, 1700));
  assert.ok(validateLapBoundaries([{ atMeters: 500, atSeconds: 150 }, { atMeters: 502, atSeconds: 151 }], 5000, 1700));
  assert.ok(validateLapBoundaries([{ atMeters: 6000, atSeconds: 150 }], 5000, 1700));
  assert.ok(validateLapBoundaries([{ atMeters: 500, atSeconds: 2000 }], 5000, 1700));
  const many = Array.from({ length: 101 }, (_, i) => ({ atMeters: (i + 1) * 10, atSeconds: (i + 1) * 10 }));
  assert.ok(validateLapBoundaries(many, 5000, 5000));
  assert.equal(validateLapBoundaries([], 5000, 1700), null);
  assert.equal(validateLapBoundaries(null, 5000, 1700), null);
  assert.deepEqual(deriveLaps(null, 5000, 1700), []);
}

// A metre of rounding slack at the finish is tolerated; a lap with no distance has no pace.
{
  assert.equal(validateLapBoundaries([{ atMeters: 5000.6, atSeconds: 1690 }], 5000, 1700), null);
  const derived = deriveLaps([{ atMeters: 3, atSeconds: 60 }], 5000, 1700);
  assert.equal(derived[0].paceSecondsPerKm, null);
}

console.log("laps OK");
