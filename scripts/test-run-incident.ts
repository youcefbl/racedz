import assert from "node:assert/strict";
import { clampedStepAt, optionalStepAt } from "../src/lib/coach/guidance-step";
import { advanceHighSpeedWindow, NON_FOOT_AUTO_PAUSE_SECONDS, restoreAsPausedTiming } from "../src/lib/native/run-lifecycle";
import { parseActiveRunSnapshot } from "../src/lib/native/run-snapshot";

const steps = ["warmup", "work", "cooldown"];
assert.equal(clampedStepAt(steps, 99), "cooldown");
assert.equal(clampedStepAt(steps, -4), "warmup");
assert.equal(optionalStepAt(steps, 3), null);
assert.equal(optionalStepAt(["only"], 1), null);

const startedAt = Date.UTC(2026, 6, 27, 10, 0, 0);
const updatedAt = startedAt + 10 * 60_000;
const restoredAt = updatedAt + 3 * 60 * 60_000;
const restored = restoreAsPausedTiming({ startTs: startedAt, pausedAccum: 0, updatedAt }, restoredAt);
assert.equal(restored.elapsedSec, 10 * 60);
assert.equal(restored.pausedAccum, 3 * 60 * 60_000);

let highSpeedSeconds = 0;
for (let second = 0; second < NON_FOOT_AUTO_PAUSE_SECONDS - 1; second += 1) {
  highSpeedSeconds = advanceHighSpeedWindow(highSpeedSeconds, 8, 1);
}
assert.equal(highSpeedSeconds, NON_FOOT_AUTO_PAUSE_SECONDS - 1);
highSpeedSeconds = advanceHighSpeedWindow(highSpeedSeconds, 8, 1);
assert.equal(highSpeedSeconds, NON_FOOT_AUTO_PAUSE_SECONDS);
assert.equal(advanceHighSpeedWindow(highSpeedSeconds, 3, 1), 0, "a foot-speed segment resets the sustained window");

const ownedV1 = JSON.stringify({
  v: 1,
  userId: "runner-a",
  status: "tracking",
  startTs: startedAt,
  pausedAccum: 0,
  distanceM: 1000,
  elevationM: 10,
  movingSec: 300,
  lastPointTs: updatedAt,
  effort: 5,
  share: false,
  route: [
    { lat: 36.75, lng: 3.05, t: startedAt },
    { lat: 36.751, lng: 3.051, t: updatedAt }
  ],
  updatedAt
});
assert.equal(parseActiveRunSnapshot(ownedV1, "runner-a", updatedAt)?.v, 2, "owned v1 snapshots migrate to v2");
assert.equal(parseActiveRunSnapshot(ownedV1, "runner-b", updatedAt), null, "another account cannot inherit the route");
assert.equal(parseActiveRunSnapshot(ownedV1.replace('"userId":"runner-a",', ""), "runner-a", updatedAt), null, "unowned legacy data stays quarantined");
assert.equal(parseActiveRunSnapshot(ownedV1.replace('"v":1', '"v":99'), "runner-a", updatedAt), null, "unsupported versions are rejected");
assert.equal(
  parseActiveRunSnapshot(ownedV1.replace(String(startedAt), String(updatedAt + 10 * 60_000)), "runner-a", updatedAt),
  null,
  "future-dated snapshots are rejected"
);
assert.equal(parseActiveRunSnapshot("{broken", "runner-a", updatedAt), null);

console.log("Run incident lifecycle, snapshot, speed-window, and guidance checks passed.");
