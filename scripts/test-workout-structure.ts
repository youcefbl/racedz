import assert from "node:assert/strict";
import {
  buildGuidedSession,
  buildWorkoutStructure,
  describeTarget,
  estimateStructureDistanceKm,
  flattenStructure,
  summarizeStructure,
  GUIDED_SESSION_TEMPLATES
} from "../src/lib/coach/workout-structure";

// --- INTERVAL: warm-up + N×(400 m hard / 90 s easy) + cool-down ---
const interval = buildWorkoutStructure({ workoutType: "INTERVAL", targetDistanceKm: 6, targetDurationMin: null });
assert.ok(interval, "interval structure should exist");
const intervalSteps = flattenStructure(interval!);
// 1 warm-up + 6 reps × 2 steps + 1 cool-down = 14
assert.equal(intervalSteps.length, 14);
assert.equal(intervalSteps[0]!.role, "WARMUP");
assert.deepEqual(intervalSteps[0]!.target, { type: "TIME", seconds: 600 });
assert.equal(intervalSteps[1]!.role, "WORK");
assert.deepEqual(intervalSteps[1]!.target, { type: "DISTANCE", meters: 400 });
assert.deepEqual(intervalSteps[1]!.rep, { current: 1, total: 6 });
assert.equal(intervalSteps[2]!.role, "RECOVERY");
assert.deepEqual(intervalSteps[2]!.target, { type: "TIME", seconds: 90 });
assert.equal(intervalSteps[13]!.role, "COOLDOWN");
// indices + total are stamped correctly on every step
assert.ok(intervalSteps.every((step, i) => step.index === i && step.total === 14));

// Reps scale with distance and clamp to [4, 10].
assert.equal(flattenStructure(buildWorkoutStructure({ workoutType: "INTERVAL", targetDistanceKm: 3, targetDurationMin: null })!).length, 1 + 4 * 2 + 1);
assert.equal(flattenStructure(buildWorkoutStructure({ workoutType: "INTERVAL", targetDistanceKm: 40, targetDurationMin: null })!).length, 1 + 10 * 2 + 1);

// --- TEMPO by duration: warm-up + sustained block + cool-down ---
const tempoByTime = buildWorkoutStructure({ workoutType: "TEMPO", targetDistanceKm: null, targetDurationMin: 40 });
const tempoTimeSteps = flattenStructure(tempoByTime!);
assert.equal(tempoTimeSteps.length, 3);
assert.equal(tempoTimeSteps[1]!.role, "STEADY");
assert.equal(tempoTimeSteps[1]!.intensity, "MODERATE");
// 40 min − 10 warm-up − 10 cool-down = 20 min block
assert.deepEqual(tempoTimeSteps[1]!.target, { type: "TIME", seconds: 1200 });

// TEMPO by distance when no duration is set.
const tempoByDist = buildWorkoutStructure({ workoutType: "TEMPO", targetDistanceKm: 8, targetDurationMin: null });
assert.deepEqual(flattenStructure(tempoByDist!)[1]!.target, { type: "DISTANCE", meters: 5000 });

// --- EASY / LONG_RUN: a single steady effort toward the target ---
const easy = flattenStructure(buildWorkoutStructure({ workoutType: "EASY", targetDistanceKm: 5, targetDurationMin: null })!);
assert.equal(easy.length, 1);
assert.equal(easy[0]!.role, "STEADY");
assert.equal(easy[0]!.intensity, "EASY");
assert.deepEqual(easy[0]!.target, { type: "DISTANCE", meters: 5000 });

// Open-ended when the workout has no numeric target at all.
const open = flattenStructure(buildWorkoutStructure({ workoutType: "EASY", targetDistanceKm: null, targetDurationMin: null })!);
assert.deepEqual(open[0]!.target, { type: "OPEN" });

// --- Non-run workouts produce no structure ---
assert.equal(buildWorkoutStructure({ workoutType: "REST", targetDistanceKm: null, targetDurationMin: null }), null);
assert.equal(buildWorkoutStructure({ workoutType: "CROSS_TRAINING", targetDistanceKm: null, targetDurationMin: null }), null);

// --- Formatting helpers ---
assert.equal(describeTarget({ type: "DISTANCE", meters: 400 }, "en"), "400 m");
assert.equal(describeTarget({ type: "DISTANCE", meters: 5000 }, "en"), "5 km");
assert.equal(describeTarget({ type: "DISTANCE", meters: 1500 }, "en"), "1.5 km");
assert.equal(describeTarget({ type: "TIME", seconds: 90 }, "en"), "1:30");
assert.equal(describeTarget({ type: "TIME", seconds: 600 }, "en"), "10:00");

// Summary reads like a session card.
const summary = summarizeStructure(interval!, "en");
assert.ok(summary.includes("6 × (400 m / 1:30)"), `summary was: ${summary}`);
assert.ok(summary.startsWith("Warm-up 10:00"), `summary was: ${summary}`);

// Distance estimate is a sane positive number.
const easyStructure = buildWorkoutStructure({ workoutType: "EASY", targetDistanceKm: 5, targetDurationMin: null })!;
assert.ok(estimateStructureDistanceKm(interval!) > 0);
assert.equal(estimateStructureDistanceKm(easyStructure), 5);

// --- Guided session library templates (audio plan, Phase C) ---
{
  // Every template builds a valid structure from its defaults, and its workout type maps cleanly.
  for (const template of GUIDED_SESSION_TEMPLATES) {
    const structure = buildGuidedSession(template, {});
    const steps = flattenStructure(structure);
    assert.ok(steps.length >= 1, template.id);
    assert.ok(estimateStructureDistanceKm(structure) > 0, template.id);
  }

  // Norwegian: 4×4 min work with 3 min recoveries, bounded params clamp.
  const norwegian = GUIDED_SESSION_TEMPLATES.find((t) => t.id === "norwegian")!;
  const nw = flattenStructure(buildGuidedSession(norwegian, { reps: 4, workMinutes: 4 }));
  const work = nw.filter((s) => s.role === "WORK");
  assert.equal(work.length, 4);
  assert.deepEqual(work[0]!.target, { type: "TIME", seconds: 240 });
  const clamped = flattenStructure(buildGuidedSession(norwegian, { reps: 99, workMinutes: 0 }));
  assert.equal(clamped.filter((s) => s.role === "WORK").length, 5); // reps max
  assert.deepEqual(clamped.filter((s) => s.role === "WORK")[0]!.target, { type: "TIME", seconds: 180 }); // workMinutes min

  // Strides: easy block first, then short pickups.
  const strides = GUIDED_SESSION_TEMPLATES.find((t) => t.id === "strides")!;
  const st = flattenStructure(buildGuidedSession(strides, { easyMinutes: 20, reps: 6 }));
  assert.equal(st[0]!.role, "STEADY");
  assert.deepEqual(st[0]!.target, { type: "TIME", seconds: 1200 });
  assert.equal(st.filter((s) => s.role === "WORK" && s.target.type === "TIME" && s.target.seconds === 20).length, 6);

  // Recovery: one easy timed block, nothing else.
  const recovery = GUIDED_SESSION_TEMPLATES.find((t) => t.id === "recovery")!;
  const rec = flattenStructure(buildGuidedSession(recovery, { durationMin: 30 }));
  assert.equal(rec.length, 1);
  assert.deepEqual(rec[0]!.target, { type: "TIME", seconds: 1800 });
}

console.log("Workout structure + guidance derivation checks passed.");
