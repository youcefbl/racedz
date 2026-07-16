import type { ExecStep } from "@/lib/coach/workout-structure";

// Audio coaching profiles (audio-coaching plan, Phase B). Each training type is coached
// differently: an interval session needs rep splits and drive, a Norwegian threshold session needs
// control ("don't go too hard"), a recovery run needs to be protected from enthusiasm, and a long
// run mostly needs company. This module is pure and deterministic — it decides WHICH cue fires
// WHEN; the spoken words live in audio-copy.ts and the sound pipeline in lib/native/cues.ts.
//
// Anti-nag rules are global: at most one spoken cue per tick, a minimum gap between spoken cues,
// pace judgment only after a step has settled, and wide tolerance bands so GPS noise never
// triggers a false correction.

export type AudioProfileId =
  | "INTERVAL"
  | "TEMPO"
  | "EASY"
  | "LONG_RUN"
  | "RECOVERY"
  | "RACE"
  | "STRIDES"
  | "THRESHOLD";

export type PaceGuidance = "band" | "ceiling" | "none"; // ceiling = "slow down" cues only

export type AudioProfile = {
  id: AudioProfileId;
  splits: boolean; // announce each km split
  paceGuidance: PaceGuidance;
  checkInSec: number | null; // periodic supportive check-in (recovery)
  hydrationSec: number | null; // periodic drink reminder (long run)
  midStepCheck: boolean; // control reminder halfway through a timed WORK rep (threshold)
  oneMinuteLeft: boolean; // "one minute left" on long timed work/steady steps
  lastRep: boolean; // encouragement when the final rep starts
  repSplit: boolean; // spoken rep time when a WORK rep ends
  formCues: boolean; // rotating form reminders during strides
  halfwaySteady: boolean; // halfway callout on the main steady block
  lastKm: boolean; // "last kilometre" on distance-target steady runs
};

const PROFILES: Record<AudioProfileId, AudioProfile> = {
  // Precision and drive. Reps are too short for GPS pace judgment — effort language only.
  INTERVAL: base({ id: "INTERVAL", oneMinuteLeft: true, lastRep: true, repSplit: true }),
  // Sustained focus: splits inside the block, both-direction pace feedback, hold-it encouragement.
  TEMPO: base({ id: "TEMPO", splits: true, paceGuidance: "band", oneMinuteLeft: true, halfwaySteady: true }),
  // Leave the runner alone: splits plus a gentle ceiling nudge if the easy day stops being easy.
  EASY: base({ id: "EASY", splits: true, paceGuidance: "ceiling" }),
  // Company over coaching: splits, halfway, hydration, and a last-km lift. No pace judgment.
  LONG_RUN: base({ id: "LONG_RUN", splits: true, hydrationSec: 25 * 60, halfwaySteady: true, lastKm: true }),
  // Protect the easy day: the ONLY pace cue is "slow down"; sparse relaxed check-ins; no splits
  // (split times invite racing them).
  RECOVERY: base({ id: "RECOVERY", paceGuidance: "ceiling", checkInSec: 5 * 60 }),
  // Race day: splits and milestones, zero coaching chatter.
  RACE: base({ id: "RACE", splits: true, halfwaySteady: true, lastKm: true }),
  // Form, not pace: 20 s pickups judged by feel, one rotating form cue per stride.
  STRIDES: base({ id: "STRIDES", lastRep: true, formCues: true }),
  // Norwegian threshold: the enemy is going too hard. Ceiling-only pace warnings, a mid-rep
  // control check, and rep splits so the runner learns what controlled feels like.
  THRESHOLD: base({ id: "THRESHOLD", paceGuidance: "ceiling", midStepCheck: true, oneMinuteLeft: true, lastRep: true, repSplit: true })
};

function base(overrides: Partial<AudioProfile> & { id: AudioProfileId }): AudioProfile {
  return {
    splits: false,
    paceGuidance: "none",
    checkInSec: null,
    hydrationSec: null,
    midStepCheck: false,
    oneMinuteLeft: false,
    lastRep: false,
    repSplit: false,
    formCues: false,
    halfwaySteady: false,
    lastKm: false,
    ...overrides
  };
}

export function getAudioProfile(id: AudioProfileId): AudioProfile {
  return PROFILES[id];
}

// Which profile coaches a workout type. STRIDES/THRESHOLD come from the guided-session library;
// planned workouts use the coach's existing enum values. Anything unknown is coached as EASY.
export function profileForWorkoutType(workoutType: string | null | undefined): AudioProfileId {
  const type = workoutType?.toUpperCase() ?? "";
  if (type in PROFILES) return type as AudioProfileId;
  return "EASY";
}

// ---------------------------------------------------------------------------------------------
// Pace limits — v1 heuristics derived from the runner's own recent (28-day) average pace, until
// the adaptive planner supplies per-workout target paces. Wide on purpose: a cue should only fire
// when the runner is clearly outside the session's intent, never as pace-keeping micromanagement.
// fastLimit / slowLimit are in seconds-per-km: running FASTER than fastLimit (i.e. a smaller
// sec/km) triggers "slower"; running slower than slowLimit triggers "faster".
// ---------------------------------------------------------------------------------------------

export type PaceLimits = { fastLimit: number | null; slowLimit: number | null };

export function paceLimitsFor(profileId: AudioProfileId, step: ExecStep, recentPaceSecPerKm: number): PaceLimits {
  // Pace is only judged on the session's purpose steps — never on warm-up/recovery/cool-down.
  if (step.role !== "STEADY" && step.role !== "WORK") return { fastLimit: null, slowLimit: null };
  switch (profileId) {
    case "RECOVERY":
      // Recovery must be slower than the everyday average — warn once it approaches it.
      return { fastLimit: recentPaceSecPerKm + 30, slowLimit: null };
    case "EASY":
      // Easy days shouldn't beat the runner's overall average pace.
      return { fastLimit: recentPaceSecPerKm, slowLimit: null };
    case "THRESHOLD":
      // Threshold sits ~45-60 s/km under easy average; warn only on clear overspeed.
      return { fastLimit: recentPaceSecPerKm - 75, slowLimit: null };
    case "TEMPO":
      // Comfortably-hard band: clearly faster than average, but not a race.
      return { fastLimit: recentPaceSecPerKm - 75, slowLimit: recentPaceSecPerKm + 30 };
    default:
      return { fastLimit: null, slowLimit: null };
  }
}

// ---------------------------------------------------------------------------------------------
// The cue scheduler. Pure state machine: feed it the live tick, it returns at most one cue event
// to speak. All state lives in the AudioCoachState object so the engine is trivially testable.
// ---------------------------------------------------------------------------------------------

export type AudioCueEvent =
  | { kind: "split"; km: number; splitSec: number }
  | { kind: "repSplit"; seconds: number }
  | { kind: "pace"; direction: "faster" | "slower" }
  | { kind: "checkIn"; index: number }
  | { kind: "hydrate" }
  | { kind: "halfway" }
  | { kind: "lastKm" }
  | { kind: "oneMinuteLeft" }
  | { kind: "midStep" }
  | { kind: "lastRep" }
  | { kind: "form"; index: number };

export type AudioTickInput = {
  elapsedSec: number;
  distanceM: number;
  currentPaceSecPerKm: number | null; // engine's smoothed live pace
  recentPaceSecPerKm: number | null; // runner's 28-day average, for the limit bands
  step: ExecStep | null; // current guidance step (null before start / after completion)
  stepRatio: number; // 0..1 progress through the current step (0 for OPEN)
  stepRemainingSec: number | null; // timed steps only
  stepRemainingM: number | null; // distance steps only
};

type PendingCue = { due: number; event: AudioCueEvent };

export type AudioCoachState = {
  stepIndex: number | null;
  stepEnteredAtSec: number;
  lastRepRoleWasWork: boolean;
  lastKmMark: number;
  lastKmAtSec: number;
  lastSpokenAtSec: number;
  lastPaceCueAtSec: number;
  lastCheckInAtSec: number;
  lastHydrationAtSec: number;
  checkInIndex: number;
  formIndex: number;
  halfwayFired: boolean;
  lastKmFired: boolean;
  oneMinuteFiredStep: number | null;
  midStepFiredStep: number | null;
  pending: PendingCue[];
};

export function createAudioCoachState(): AudioCoachState {
  return {
    stepIndex: null,
    stepEnteredAtSec: 0,
    lastRepRoleWasWork: false,
    lastKmMark: 0,
    lastKmAtSec: 0,
    lastSpokenAtSec: -999,
    lastPaceCueAtSec: -999,
    lastCheckInAtSec: 0,
    lastHydrationAtSec: 0,
    checkInIndex: 0,
    formIndex: 0,
    halfwayFired: false,
    lastKmFired: false,
    oneMinuteFiredStep: null,
    midStepFiredStep: null,
    pending: []
  };
}

// Anti-nag constants (exported so tests can pin them).
export const PACE_CUE_MIN_GAP_SEC = 90; // never two pace corrections within 90 s
export const STEP_PACE_GRACE_SEC = 30; // no pace judgment in a step's first 30 s
export const SPOKEN_CUE_MIN_GAP_SEC = 5; // breathing room between any two spoken cues
export const TRANSITION_CUE_DELAY_SEC = 4; // rep-split/last-rep wait out the step announcement
export const FORM_CUE_DELAY_SEC = 6; // form cue lands a moment into the stride
const MAX_PENDING = 3; // drop stale commentary rather than monologue
const MIN_REP_SPLIT_SEC = 20; // don't announce split times for micro-reps

/**
 * Advance the scheduler by one tick. Mutates `state`; returns at most ONE event to speak now
 * (plus updates its internal pending queue). Call only while tracking — the caller resets state
 * via createAudioCoachState() when a run starts.
 */
export function collectAudioCue(profile: AudioProfile, state: AudioCoachState, input: AudioTickInput): AudioCueEvent | null {
  const { elapsedSec, distanceM, step } = input;

  const push = (event: AudioCueEvent, due = elapsedSec) => {
    if (state.pending.length >= MAX_PENDING) state.pending.shift();
    state.pending.push({ due, event });
  };

  // --- Step transitions: rep splits for the step just finished, encouragement for the one starting.
  // Both are delayed a few seconds so they don't cancel the step announcement (newest cue wins in
  // the speech layer).
  if (step && state.stepIndex !== step.index) {
    const prevEntered = state.stepEnteredAtSec;
    const hadPrev = state.stepIndex !== null;
    if (hadPrev && profile.repSplit) {
      const repSeconds = Math.round(elapsedSec - prevEntered);
      // Only WORK reps get spoken times; we detect "previous was WORK" by the new step following
      // a rep (the recovery/next step's rep counter still points at the same or next rep).
      if (state.lastRepRoleWasWork && repSeconds >= MIN_REP_SPLIT_SEC) {
        push({ kind: "repSplit", seconds: repSeconds }, elapsedSec + TRANSITION_CUE_DELAY_SEC);
      }
    }
    if (profile.lastRep && step.role === "WORK" && step.rep && step.rep.current === step.rep.total) {
      push({ kind: "lastRep" }, elapsedSec + TRANSITION_CUE_DELAY_SEC);
    }
    if (profile.formCues && step.role === "WORK") {
      push({ kind: "form", index: state.formIndex }, elapsedSec + FORM_CUE_DELAY_SEC);
      state.formIndex += 1;
    }
    state.stepIndex = step.index;
    state.stepEnteredAtSec = elapsedSec;
    state.lastRepRoleWasWork = step.role === "WORK";
  }

  // --- Km splits.
  const kmMark = Math.floor(distanceM / 1000);
  if (kmMark > state.lastKmMark) {
    const splitSec = Math.round(elapsedSec - state.lastKmAtSec);
    if (profile.splits && splitSec > 0) push({ kind: "split", km: kmMark, splitSec });
    state.lastKmMark = kmMark;
    state.lastKmAtSec = elapsedSec;
  }

  if (step) {
    const stepElapsed = elapsedSec - state.stepEnteredAtSec;

    // --- Milestones on the main steady block.
    if (profile.halfwaySteady && step.role === "STEADY" && !state.halfwayFired && input.stepRatio >= 0.5) {
      state.halfwayFired = true;
      push({ kind: "halfway" });
    }
    if (
      profile.lastKm &&
      step.role === "STEADY" &&
      !state.lastKmFired &&
      input.stepRemainingM !== null &&
      input.stepRemainingM <= 1000 &&
      input.stepRemainingM > 0 &&
      step.target.type === "DISTANCE" &&
      step.target.meters > 3000
    ) {
      state.lastKmFired = true;
      push({ kind: "lastKm" });
    }

    // --- Timed-step milestones (one minute left / mid-rep control check).
    if (
      profile.oneMinuteLeft &&
      (step.role === "WORK" || step.role === "STEADY") &&
      step.target.type === "TIME" &&
      step.target.seconds >= 180 &&
      input.stepRemainingSec !== null &&
      input.stepRemainingSec <= 60 &&
      state.oneMinuteFiredStep !== step.index
    ) {
      state.oneMinuteFiredStep = step.index;
      push({ kind: "oneMinuteLeft" });
    }
    if (
      profile.midStepCheck &&
      step.role === "WORK" &&
      step.target.type === "TIME" &&
      step.target.seconds >= 120 &&
      input.stepRatio >= 0.5 &&
      state.midStepFiredStep !== step.index &&
      state.oneMinuteFiredStep !== step.index
    ) {
      state.midStepFiredStep = step.index;
      push({ kind: "midStep" });
    }

    // --- Pace guidance (the strictly rationed one).
    if (
      profile.paceGuidance !== "none" &&
      input.currentPaceSecPerKm !== null &&
      input.recentPaceSecPerKm !== null &&
      stepElapsed >= STEP_PACE_GRACE_SEC &&
      elapsedSec - state.lastPaceCueAtSec >= PACE_CUE_MIN_GAP_SEC
    ) {
      const limits = paceLimitsFor(profile.id, step, input.recentPaceSecPerKm);
      const pace = input.currentPaceSecPerKm;
      if (limits.fastLimit !== null && pace < limits.fastLimit) {
        state.lastPaceCueAtSec = elapsedSec;
        push({ kind: "pace", direction: "slower" });
      } else if (profile.paceGuidance === "band" && limits.slowLimit !== null && pace > limits.slowLimit) {
        state.lastPaceCueAtSec = elapsedSec;
        push({ kind: "pace", direction: "faster" });
      }
    }

    // --- Periodic company: check-ins and hydration.
    if (profile.checkInSec && step.role === "STEADY" && elapsedSec - state.lastCheckInAtSec >= profile.checkInSec) {
      state.lastCheckInAtSec = elapsedSec;
      push({ kind: "checkIn", index: state.checkInIndex });
      state.checkInIndex += 1;
    }
    if (profile.hydrationSec && elapsedSec - state.lastHydrationAtSec >= profile.hydrationSec) {
      state.lastHydrationAtSec = elapsedSec;
      push({ kind: "hydrate" });
    }
  }

  // --- Flush: one due cue per tick, with breathing room after the previous spoken cue.
  if (elapsedSec - state.lastSpokenAtSec < SPOKEN_CUE_MIN_GAP_SEC) return null;
  const dueIndex = state.pending.findIndex((item) => item.due <= elapsedSec);
  if (dueIndex === -1) return null;
  const [next] = state.pending.splice(dueIndex, 1);
  state.lastSpokenAtSec = elapsedSec;
  return next!.event;
}
