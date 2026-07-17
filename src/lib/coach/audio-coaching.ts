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
  // The reference is a distance-weighted 28-day average over ALL runs (easy + hard mixed), so the
  // runner's normal easy pace sits close to it. Every margin below leaves the whole "normal" range
  // silent and only fires when the runner is unambiguously outside the session's intent.
  switch (profileId) {
    case "RECOVERY":
      // Recovery should be slower than the everyday average — warn only when clearly beating it.
      return { fastLimit: recentPaceSecPerKm - 15, slowLimit: null };
    case "EASY":
      // Easy days shouldn't turn into moderate runs: warn well past the everyday average.
      return { fastLimit: recentPaceSecPerKm - 45, slowLimit: null };
    case "THRESHOLD":
      // True threshold sits ~60-90 s/km under the mixed average; warn only on egregious overspeed.
      return { fastLimit: recentPaceSecPerKm - 105, slowLimit: null };
    case "TEMPO":
      // Comfortably-hard band, kept wide: racing, or jogging the tempo block.
      return { fastLimit: recentPaceSecPerKm - 90, slowLimit: recentPaceSecPerKm + 45 };
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
  | { kind: "form"; index: number }
  | { kind: "warmupTip" }
  | { kind: "warmupLastMinute" }
  | { kind: "cooldownTip" };

export type AudioTickInput = {
  elapsedSec: number;
  distanceM: number;
  // Engine's live pace. NOT smoothed — it's derived from the latest GPS fix's speed, so a single
  // bad fix can spike it; the dwell requirement below is what protects against false corrections.
  currentPaceSecPerKm: number | null;
  recentPaceSecPerKm: number | null; // runner's 28-day average, for the limit bands
  step: ExecStep | null; // current guidance step (null before start / after completion)
  stepRatio: number; // 0..1 progress through the current step (0 for OPEN)
  stepRemainingSec: number | null; // timed steps only
  stepRemainingM: number | null; // distance steps only
  // Runner preference (audio settings): spoken tips during warm-up and cool-down steps —
  // "start gently" a moment in, "one minute left" before the work begins, "ease right off"
  // into the cool-down. Off = those steps keep only their transition announcement.
  warmupCooldownGuidance: boolean;
};

type PendingCue = { due: number; event: AudioCueEvent };

export type AudioCoachState = {
  stepIndex: number | null;
  stepEnteredAtSec: number;
  prevStepRole: string | null; // role of the step we were in before the current one
  paceBreachDirection: "faster" | "slower" | null; // current out-of-band direction, if any
  paceBreachSinceSec: number | null; // when the current breach started (for the dwell rule)
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
  warmupTipFiredStep: number | null;
  warmupLastMinFiredStep: number | null;
  cooldownTipFiredStep: number | null;
  pending: PendingCue[];
};

export function createAudioCoachState(): AudioCoachState {
  return {
    stepIndex: null,
    stepEnteredAtSec: 0,
    prevStepRole: null,
    paceBreachDirection: null,
    paceBreachSinceSec: null,
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
    warmupTipFiredStep: null,
    warmupLastMinFiredStep: null,
    cooldownTipFiredStep: null,
    pending: []
  };
}

// Anti-nag constants (exported so tests can pin them).
export const PACE_CUE_MIN_GAP_SEC = 90; // never two pace corrections within 90 s
export const STEP_PACE_GRACE_SEC = 30; // no pace judgment in a step's first 30 s
export const PACE_DWELL_SEC = 15; // pace must stay out of band this long — one bad GPS fix never speaks
export const SPOKEN_CUE_MIN_GAP_SEC = 5; // breathing room between any two spoken cues
export const TRANSITION_CUE_DELAY_SEC = 4; // rep-split/last-rep wait out the step announcement
export const FORM_CUE_DELAY_SEC = 6; // form cue lands a moment into the stride
export const PHASE_TIP_DELAY_SEC = 8; // warm-up/cool-down tip lands after the announcement settles
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
    if (profile.repSplit && state.prevStepRole === "WORK") {
      const repSeconds = Math.round(elapsedSec - prevEntered);
      if (repSeconds >= MIN_REP_SPLIT_SEC) {
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
    state.prevStepRole = step.role;
    // A new pace judgment starts fresh in the new step.
    state.paceBreachDirection = null;
    state.paceBreachSinceSec = null;
    // The step announcement (spoken by the guidance hook on this same tick) owns the speech
    // channel: mark it as the last spoken cue so the flush gap below keeps every immediate-due
    // commentary cue (splits, check-ins, hydration) clear of it — the speech layer is
    // newest-cue-wins, so speaking over the announcement would cut it off mid-word.
    state.lastSpokenAtSec = elapsedSec;
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

    // --- Optional warm-up / cool-down guidance (runner preference, not profile-specific).
    if (input.warmupCooldownGuidance) {
      if (step.role === "WARMUP" && state.warmupTipFiredStep !== step.index && stepElapsed >= PHASE_TIP_DELAY_SEC) {
        state.warmupTipFiredStep = step.index;
        push({ kind: "warmupTip" });
      }
      if (
        step.role === "WARMUP" &&
        step.target.type === "TIME" &&
        step.target.seconds >= 300 &&
        input.stepRemainingSec !== null &&
        input.stepRemainingSec <= 60 &&
        state.warmupLastMinFiredStep !== step.index
      ) {
        state.warmupLastMinFiredStep = step.index;
        push({ kind: "warmupLastMinute" });
      }
      if (step.role === "COOLDOWN" && state.cooldownTipFiredStep !== step.index && stepElapsed >= PHASE_TIP_DELAY_SEC) {
        state.cooldownTipFiredStep = step.index;
        push({ kind: "cooldownTip" });
      }
    }

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

    // --- Pace guidance (the strictly rationed one). The live pace is a single GPS fix, so a cue
    // needs a sustained breach (dwell) — one glitchy reading under a bridge must never speak.
    if (profile.paceGuidance !== "none" && input.currentPaceSecPerKm !== null && input.recentPaceSecPerKm !== null && stepElapsed >= STEP_PACE_GRACE_SEC) {
      const limits = paceLimitsFor(profile.id, step, input.recentPaceSecPerKm);
      const pace = input.currentPaceSecPerKm;
      const breach: "faster" | "slower" | null =
        limits.fastLimit !== null && pace < limits.fastLimit
          ? "slower"
          : profile.paceGuidance === "band" && limits.slowLimit !== null && pace > limits.slowLimit
            ? "faster"
            : null;
      if (!breach) {
        state.paceBreachDirection = null;
        state.paceBreachSinceSec = null;
      } else {
        if (state.paceBreachDirection !== breach || state.paceBreachSinceSec === null) {
          state.paceBreachDirection = breach;
          state.paceBreachSinceSec = elapsedSec;
        }
        if (
          elapsedSec - state.paceBreachSinceSec >= PACE_DWELL_SEC &&
          elapsedSec - state.lastPaceCueAtSec >= PACE_CUE_MIN_GAP_SEC
        ) {
          state.lastPaceCueAtSec = elapsedSec;
          push({ kind: "pace", direction: breach });
        }
      }
    } else {
      state.paceBreachDirection = null;
      state.paceBreachSinceSec = null;
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
