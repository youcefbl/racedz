import assert from "node:assert/strict";
import {
  collectAudioCue,
  createAudioCoachState,
  getAudioProfile,
  paceLimitsFor,
  profileForWorkoutType,
  FORM_CUE_DELAY_SEC,
  PACE_CUE_MIN_GAP_SEC,
  SPOKEN_CUE_MIN_GAP_SEC,
  TRANSITION_CUE_DELAY_SEC,
  type AudioCoachState,
  type AudioCueEvent,
  type AudioProfile,
  type AudioTickInput
} from "../src/lib/coach/audio-coaching";
import { audioCueText, spokenDuration } from "../src/lib/coach/audio-copy";
import type { ExecStep } from "../src/lib/coach/workout-structure";

// Deterministic checks for the audio-coaching cue scheduler (audio plan, Phase B): profile
// selection, pace-band limits, anti-nag pacing, and the per-profile signature cues.

function step(partial: Partial<ExecStep> & { index: number }): ExecStep {
  return {
    role: "STEADY",
    intensity: "EASY",
    target: { type: "DISTANCE", meters: 8000 },
    total: 1,
    ...partial
  };
}

function tick(
  profile: AudioProfile,
  state: AudioCoachState,
  input: Partial<AudioTickInput> & { elapsedSec: number }
): AudioCueEvent | null {
  return collectAudioCue(profile, state, {
    distanceM: 0,
    currentPaceSecPerKm: null,
    recentPaceSecPerKm: null,
    step: null,
    stepRatio: 0,
    stepRemainingSec: null,
    stepRemainingM: null,
    warmupCooldownGuidance: false,
    ...input
  });
}

// --- Profile selection ---------------------------------------------------------------------
assert.equal(profileForWorkoutType("INTERVAL"), "INTERVAL");
assert.equal(profileForWorkoutType("long_run"), "LONG_RUN");
assert.equal(profileForWorkoutType("STRIDES"), "STRIDES");
assert.equal(profileForWorkoutType("THRESHOLD"), "THRESHOLD");
assert.equal(profileForWorkoutType("SOMETHING_NEW"), "EASY");
assert.equal(profileForWorkoutType(null), "EASY");

// --- Pace limits ---------------------------------------------------------------------------
const recovery = getAudioProfile("RECOVERY");
const steady = step({ index: 0 });
assert.deepEqual(paceLimitsFor("RECOVERY", steady, 360), { fastLimit: 390, slowLimit: null });
assert.deepEqual(paceLimitsFor("EASY", steady, 360), { fastLimit: 360, slowLimit: null });
assert.deepEqual(paceLimitsFor("TEMPO", steady, 360), { fastLimit: 285, slowLimit: 390 });
// Warm-ups are never pace-judged.
assert.deepEqual(paceLimitsFor("RECOVERY", step({ index: 0, role: "WARMUP" }), 360), { fastLimit: null, slowLimit: null });

// --- Recovery run: ceiling-only pace cues, rationed -----------------------------------------
{
  const state = createAudioCoachState();
  // Enter the steady step; too fast from the start (pace 330 vs ceiling 390... 330 < 390 → slower).
  const base = { step: steady, stepRatio: 0.1, currentPaceSecPerKm: 330, recentPaceSecPerKm: 360 };
  // Inside the 30 s grace window: silent.
  assert.equal(tick(recovery, state, { elapsedSec: 10, ...base }), null);
  // After grace: one "slower" cue.
  const cue = tick(recovery, state, { elapsedSec: 40, ...base });
  assert.deepEqual(cue, { kind: "pace", direction: "slower" });
  // Still fast 30 s later: rationed (90 s minimum gap).
  assert.equal(tick(recovery, state, { elapsedSec: 70, ...base }), null);
  // After the gap: allowed again.
  const cue2 = tick(recovery, state, { elapsedSec: 40 + PACE_CUE_MIN_GAP_SEC, ...base });
  assert.deepEqual(cue2, { kind: "pace", direction: "slower" });
  // Recovery never says "faster", even when far above any pace.
  const slowState = createAudioCoachState();
  tick(recovery, slowState, { elapsedSec: 1, step: steady, stepRatio: 0.1 });
  assert.equal(
    tick(recovery, slowState, { elapsedSec: 60, step: steady, stepRatio: 0.2, currentPaceSecPerKm: 600, recentPaceSecPerKm: 360 }),
    null
  );
}

// --- Recovery check-ins rotate; no splits on recovery ----------------------------------------
{
  const state = createAudioCoachState();
  tick(recovery, state, { elapsedSec: 1, step: steady, stepRatio: 0 });
  const first = tick(recovery, state, { elapsedSec: 301, step: steady, stepRatio: 0.3 });
  assert.deepEqual(first, { kind: "checkIn", index: 0 });
  const second = tick(recovery, state, { elapsedSec: 602, step: steady, stepRatio: 0.6 });
  assert.deepEqual(second, { kind: "checkIn", index: 1 });
  // A km crossing on a recovery run stays silent (splits invite racing them).
  assert.equal(tick(recovery, state, { elapsedSec: 700, distanceM: 1005, step: steady, stepRatio: 0.7 }), null);
}

// --- Long run: splits with correct time, hydration, halfway, last km -------------------------
{
  const longRun = getAudioProfile("LONG_RUN");
  const long = step({ index: 0, target: { type: "DISTANCE", meters: 12000 } });
  const state = createAudioCoachState();
  tick(longRun, state, { elapsedSec: 1, step: long, stepRatio: 0 });
  const split = tick(longRun, state, { elapsedSec: 361, distanceM: 1010, step: long, stepRatio: 0.08 });
  assert.deepEqual(split, { kind: "split", km: 1, splitSec: 361 });
  const split2 = tick(longRun, state, { elapsedSec: 700, distanceM: 2020, step: long, stepRatio: 0.17 });
  assert.deepEqual(split2, { kind: "split", km: 2, splitSec: 339 });
  // Hydration at 25 minutes (tick without a km crossing, so only one event is due).
  const hydrate = tick(longRun, state, { elapsedSec: 1501, distanceM: 2900, step: long, stepRatio: 0.36 });
  assert.deepEqual(hydrate, { kind: "hydrate" });
  // Halfway on the steady block.
  const halfway = tick(longRun, state, { elapsedSec: 1800, distanceM: 2950, step: long, stepRatio: 0.51 });
  assert.deepEqual(halfway, { kind: "halfway" });
  // Last kilometre.
  const lastKm = tick(longRun, state, { elapsedSec: 3900, distanceM: 2990, step: long, stepRatio: 0.93, stepRemainingM: 900 });
  assert.deepEqual(lastKm, { kind: "lastKm" });
}

// --- Intervals: rep split + last-rep encouragement, delayed past the step announcement -------
{
  const intervals = getAudioProfile("INTERVAL");
  const work = (index: number, rep: number, total: number): ExecStep =>
    step({ index, role: "WORK", intensity: "HARD", target: { type: "DISTANCE", meters: 400 }, rep: { current: rep, total } });
  const rec = (index: number, rep: number, total: number): ExecStep =>
    step({ index, role: "RECOVERY", intensity: "EASY", target: { type: "TIME", seconds: 90 }, rep: { current: rep, total } });

  const state = createAudioCoachState();
  tick(intervals, state, { elapsedSec: 1, step: work(0, 1, 2), stepRatio: 0 });
  // WORK rep took 95 s, then transition to recovery: the rep split waits out the announcement...
  assert.equal(tick(intervals, state, { elapsedSec: 96, step: rec(1, 1, 2), stepRatio: 0 }), null);
  // ...and lands after the delay.
  const repSplit = tick(intervals, state, { elapsedSec: 96 + TRANSITION_CUE_DELAY_SEC, step: rec(1, 1, 2), stepRatio: 0.05 });
  assert.deepEqual(repSplit, { kind: "repSplit", seconds: 95 });
  // Final rep starts → delayed "last one" encouragement.
  assert.equal(tick(intervals, state, { elapsedSec: 186, step: work(2, 2, 2), stepRatio: 0 }), null);
  const lastRep = tick(intervals, state, { elapsedSec: 186 + TRANSITION_CUE_DELAY_SEC, step: work(2, 2, 2), stepRatio: 0.1 });
  assert.deepEqual(lastRep, { kind: "lastRep" });
}

// --- Threshold: mid-rep control check and one-minute-left ------------------------------------
{
  const threshold = getAudioProfile("THRESHOLD");
  const rep = step({ index: 1, role: "WORK", intensity: "HARD", target: { type: "TIME", seconds: 240 }, rep: { current: 1, total: 4 } });
  const state = createAudioCoachState();
  tick(threshold, state, { elapsedSec: 600, step: rep, stepRatio: 0 });
  const mid = tick(threshold, state, { elapsedSec: 721, step: rep, stepRatio: 0.5, stepRemainingSec: 120 });
  assert.deepEqual(mid, { kind: "midStep" });
  const oneMin = tick(threshold, state, { elapsedSec: 781, step: rep, stepRatio: 0.75, stepRemainingSec: 59 });
  assert.deepEqual(oneMin, { kind: "oneMinuteLeft" });
  // Fires once per step.
  assert.equal(tick(threshold, state, { elapsedSec: 800, step: rep, stepRatio: 0.85, stepRemainingSec: 40 }), null);
}

// --- Strides: rotating form cues a moment into each pickup -----------------------------------
{
  const strides = getAudioProfile("STRIDES");
  const pickup = (index: number, rep: number): ExecStep =>
    step({ index, role: "WORK", intensity: "HARD", target: { type: "TIME", seconds: 20 }, rep: { current: rep, total: 6 } });
  const state = createAudioCoachState();
  tick(strides, state, { elapsedSec: 300, step: pickup(1, 1), stepRatio: 0 });
  assert.equal(tick(strides, state, { elapsedSec: 302, step: pickup(1, 1), stepRatio: 0.1 }), null);
  const form = tick(strides, state, { elapsedSec: 300 + FORM_CUE_DELAY_SEC, step: pickup(1, 1), stepRatio: 0.3 });
  assert.deepEqual(form, { kind: "form", index: 0 });
  // Next pickup rotates the cue.
  tick(strides, state, { elapsedSec: 360, step: pickup(3, 2), stepRatio: 0 });
  const form2 = tick(strides, state, { elapsedSec: 360 + FORM_CUE_DELAY_SEC, step: pickup(3, 2), stepRatio: 0.3 });
  assert.deepEqual(form2, { kind: "form", index: 1 });
}

// --- Anti-nag: one spoken cue per tick, breathing room between cues ---------------------------
{
  const tempo = getAudioProfile("TEMPO");
  const block = step({ index: 1, role: "STEADY", intensity: "MODERATE", target: { type: "TIME", seconds: 1200 } });
  const state = createAudioCoachState();
  tick(tempo, state, { elapsedSec: 600, step: block, stepRatio: 0 });
  // Km crossing AND halfway hit on the same tick → only one speaks now...
  const first = tick(tempo, state, {
    elapsedSec: 900,
    distanceM: 3010,
    step: block,
    stepRatio: 0.5,
    stepRemainingSec: 600
  });
  assert.ok(first !== null);
  // ...the other waits for the breathing gap, then lands.
  assert.equal(tick(tempo, state, { elapsedSec: 901, distanceM: 3015, step: block, stepRatio: 0.5, stepRemainingSec: 599 }), null);
  const second = tick(tempo, state, {
    elapsedSec: 900 + SPOKEN_CUE_MIN_GAP_SEC,
    distanceM: 3030,
    step: block,
    stepRatio: 0.51,
    stepRemainingSec: 595
  });
  assert.ok(second !== null);
  assert.notEqual(first!.kind, second!.kind);
}

// --- Warm-up/cool-down guidance: optional, delayed past the announcement, once per step -------
{
  const intervals = getAudioProfile("INTERVAL");
  const warmup = step({ index: 0, role: "WARMUP", target: { type: "TIME", seconds: 600 } });
  const cooldown = step({ index: 5, role: "COOLDOWN", target: { type: "TIME", seconds: 600 } });

  // Toggle off: warm-up stays quiet.
  const off = createAudioCoachState();
  tick(intervals, off, { elapsedSec: 1, step: warmup });
  assert.equal(tick(intervals, off, { elapsedSec: 30, step: warmup, stepRatio: 0.05 }), null);

  // Toggle on: tip lands after the step announcement settles, once.
  const on = createAudioCoachState();
  tick(intervals, on, { elapsedSec: 1, step: warmup, warmupCooldownGuidance: true });
  assert.equal(tick(intervals, on, { elapsedSec: 4, step: warmup, stepRatio: 0.01, warmupCooldownGuidance: true }), null);
  const wtip = tick(intervals, on, { elapsedSec: 10, step: warmup, stepRatio: 0.02, warmupCooldownGuidance: true });
  assert.deepEqual(wtip, { kind: "warmupTip" });
  assert.equal(tick(intervals, on, { elapsedSec: 40, step: warmup, stepRatio: 0.07, warmupCooldownGuidance: true }), null);
  // One minute left of a long warm-up: get ready to work.
  const wlast = tick(intervals, on, {
    elapsedSec: 541,
    step: warmup,
    stepRatio: 0.9,
    stepRemainingSec: 59,
    warmupCooldownGuidance: true
  });
  assert.deepEqual(wlast, { kind: "warmupLastMinute" });
  // Cool-down tip after its announcement.
  tick(intervals, on, { elapsedSec: 1800, step: cooldown, warmupCooldownGuidance: true });
  const ctip = tick(intervals, on, { elapsedSec: 1810, step: cooldown, stepRatio: 0.02, warmupCooldownGuidance: true });
  assert.deepEqual(ctip, { kind: "cooldownTip" });
}

// --- Copy: every event kind speaks a non-empty phrase in every locale -------------------------
{
  const events: AudioCueEvent[] = [
    { kind: "split", km: 4, splitSec: 342 },
    { kind: "repSplit", seconds: 95 },
    { kind: "pace", direction: "slower" },
    { kind: "pace", direction: "faster" },
    { kind: "checkIn", index: 5 },
    { kind: "hydrate" },
    { kind: "halfway" },
    { kind: "lastKm" },
    { kind: "oneMinuteLeft" },
    { kind: "midStep" },
    { kind: "lastRep" },
    { kind: "form", index: 7 },
    { kind: "warmupTip" },
    { kind: "warmupLastMinute" },
    { kind: "cooldownTip" }
  ];
  for (const locale of ["en", "fr", "ar"] as const) {
    for (const event of events) {
      for (const profileId of ["RECOVERY", "THRESHOLD", "TEMPO"] as const) {
        const text = audioCueText(event, profileId, locale);
        assert.ok(text.length > 3, `${event.kind}/${profileId}/${locale}`);
      }
    }
  }
  assert.equal(spokenDuration(342, "en"), "5 minutes 42");
  assert.equal(spokenDuration(42, "en"), "42 seconds");
  assert.equal(spokenDuration(300, "fr"), "5 minutes");
  assert.equal(spokenDuration(342, "ar"), "5 دقيقة و42 ثانية");
}

console.log("audio coaching checks passed");
