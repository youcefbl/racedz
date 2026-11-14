import assert from "node:assert/strict";
import { coachLocalDate, describeSleep } from "../src/lib/coach/context-time";
const now = new Date("2026-11-13T23:30:00Z"); // Nov 14 in Algiers
assert.equal(coachLocalDate(now), "2026-11-14");
const sleep = describeSleep([
  { night: "2026-11-12", durationMinutes: 420 },
  { night: "2026-11-08", durationMinutes: 480 },
  { night: "2026-11-07", durationMinutes: 600 }, // outside window
  { night: "2026-11-15", durationMinutes: 900 }, // future wake date
], now)!;
assert.equal(sleep.lastNightHours, null);
assert.equal(sleep.lastNightDate, "2026-11-14");
assert.equal(sleep.nightsLoggedLast7, 2);
assert.equal(sleep.averageHoursLast7, 7.5);
assert.equal(describeSleep([{ night: "2026-11-01", durationMinutes: 480 }], now), null);
assert.equal(describeSleep([{ night: new Date("2026-11-14T00:00:00Z"), durationMinutes: 0 }], now)?.lastNightHours, 0);
assert.equal(describeSleep([{ night: "2026-11-13", durationMinutes: NaN }], now), null);
assert.equal(describeSleep([{ night: "2026-11-13", durationMinutes: 480 }, { night: "2026-11-13", durationMinutes: 480 }], now)?.nightsLoggedLast7, 1);
console.log("PASS — calendar-window sleep, missing last night, sparse logs, duplicates and Algiers midnight");
