"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExecStep } from "@/lib/coach/workout-structure";
import { clampedStepAt, optionalStepAt } from "@/lib/coach/guidance-step";

// Drives a structured workout during recording. Given the flattened steps and the live run metrics
// (elapsed seconds + distance in metres), it tracks which step the runner is on, how far through it
// they are, and auto-advances when a step's target is met — firing cues at each transition. The run
// engine is left untouched: this is a pure consumer of its state, so recording behaviour is
// unchanged whether or not a workout is attached.

type LiveMetrics = {
  status: "idle" | "tracking" | "paused" | "finished";
  elapsedSec: number;
  distanceM: number;
};

type Progress = {
  sessionKey: string;
  started: boolean;
  completed: boolean;
  stepIndex: number;
  anchorElapsed: number;
  anchorDistance: number;
  lastCountdown: number;
};

export type GuidanceView = {
  active: boolean; // a workout is attached and the run is live
  notStarted: boolean; // attached but tracking hasn't begun
  completed: boolean; // all structured steps done (free running from here)
  stepIndex: number;
  total: number;
  current: ExecStep | null;
  next: ExecStep | null;
  unit: "TIME" | "DISTANCE" | "OPEN";
  doneValue: number; // seconds or metres into the current step
  targetValue: number | null; // seconds or metres; null for OPEN
  remainingValue: number | null; // seconds or metres left; null for OPEN
  progressRatio: number; // 0..1 (0 for OPEN)
  skip: () => void; // manually finish the current step
};

function targetOf(step: ExecStep): { unit: "TIME" | "DISTANCE" | "OPEN"; value: number | null } {
  if (step.target.type === "TIME") return { unit: "TIME", value: step.target.seconds };
  if (step.target.type === "DISTANCE") return { unit: "DISTANCE", value: step.target.meters };
  return { unit: "OPEN", value: null };
}

function freshProgress(sessionKey: string): Progress {
  return { sessionKey, started: false, completed: false, stepIndex: 0, anchorElapsed: 0, anchorDistance: 0, lastCountdown: 0 };
}

// Current-step reads are clamped defensively below; optional next-step reads remain exact so the
// final step does not incorrectly advertise itself as the next step too.
// Progress lives at module scope, not in a ref: the run engine is a singleton that keeps
// recording across screen changes, and this hook's host component remounts on every tab switch —
// a mid-run remount must resume the workout exactly where it was, not restart (or kill) it.
// Keyed by `sessionKey` (run identity + workout identity + step count, supplied by the caller) so
// a *different* run or a swapped workout can never inherit a stale, now out-of-range stepIndex
// left over from a previous session.
const sharedProgress: { current: Progress } = { current: freshProgress("") };

export function useWorkoutGuidance(
  steps: ExecStep[],
  metrics: LiveMetrics,
  options: {
    enabled: boolean;
    // Identifies "this run + this workout". Changing it (new run, swapped workout, different
    // step count) resets progress instead of reusing whatever was there before.
    sessionKey: string;
    onAdvance?: (step: ExecStep) => void; // fired when a NEW step becomes current (incl. the first)
    onComplete?: () => void; // fired once when the last step finishes
    onCountdown?: (secondsLeft: number) => void; // 3-2-1 on timed steps
  }
): GuidanceView {
  const { enabled, sessionKey, onAdvance, onComplete, onCountdown } = options;
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;
  const [, bump] = useState(0);
  const forceRender = useCallback(() => bump((v) => v + 1), []);

  const { status, elapsedSec, distanceM } = metrics;

  // A session that hasn't been committed by the effect yet (see below) must never be read as
  // current — fall back to an unstarted view for this render rather than a stale one.
  const renderProgress =
    enabled && steps.length > 0 && sharedProgress.current.sessionKey === sessionKey ? sharedProgress.current : freshProgress(sessionKey);

  useEffect(() => {
    if (!enabled || steps.length === 0) return;

    // A new run or a different/changed workout: start this session's progress from scratch.
    if (sharedProgress.current.sessionKey !== sessionKey) {
      sharedProgress.current = freshProgress(sessionKey);
      forceRender();
      return;
    }

    const st = sharedProgress.current;
    // Defensive clamp even under a matching sessionKey — never trust stepIndex blindly.
    if (st.stepIndex > steps.length - 1) st.stepIndex = steps.length - 1;

    if (status !== "tracking" && status !== "paused") return; // idle or finished: freeze

    // First tick after starting: anchor step 0 and announce it.
    if (!st.started) {
      st.started = true;
      st.stepIndex = 0;
      st.anchorElapsed = elapsedSec;
      st.anchorDistance = distanceM;
      st.lastCountdown = 0;
      const first = clampedStepAt(steps, 0);
      if (first) onAdvance?.(first);
      forceRender();
      return;
    }
    if (st.completed) return;

    // Advance through every step whose target is already satisfied (handles very short steps that
    // clear within one tick). OPEN steps never auto-complete — they wait for a manual skip.
    let changed = false;
    while (st.stepIndex < steps.length) {
      const step = clampedStepAt(steps, st.stepIndex);
      if (!step) break;
      const { unit, value } = targetOf(step);
      if (value === null) break; // OPEN
      const done = unit === "TIME" ? elapsedSec - st.anchorElapsed : distanceM - st.anchorDistance;
      if (done < value) break;
      if (st.stepIndex >= steps.length - 1) {
        st.completed = true;
        onComplete?.();
        changed = true;
        break;
      }
      st.stepIndex += 1;
      st.anchorElapsed = elapsedSec;
      st.anchorDistance = distanceM;
      st.lastCountdown = 0;
      const next = clampedStepAt(steps, st.stepIndex);
      if (next) onAdvance?.(next);
      changed = true;
    }

    // 3-2-1 countdown on the current timed step.
    if (!st.completed) {
      const step = clampedStepAt(steps, st.stepIndex);
      if (step) {
        const { unit, value } = targetOf(step);
        if (unit === "TIME" && value !== null) {
          const remaining = Math.ceil(value - (elapsedSec - st.anchorElapsed));
          if (remaining >= 1 && remaining <= 3 && st.lastCountdown !== remaining) {
            st.lastCountdown = remaining;
            onCountdown?.(remaining);
          } else if (remaining > 3) {
            st.lastCountdown = 0;
          }
        }
      }
    }

    if (changed) forceRender();
  }, [enabled, sessionKey, steps, status, elapsedSec, distanceM, onAdvance, onComplete, onCountdown, forceRender]);

  const skip = useCallback(() => {
    if (!enabled || steps.length === 0) return;
    if (sharedProgress.current.sessionKey !== sessionKey) return; // stale click racing a session change
    const st = sharedProgress.current;
    if (!st.started || st.completed) return;
    const live = metricsRef.current;
    if (st.stepIndex >= steps.length - 1) {
      st.completed = true;
      onComplete?.();
    } else {
      st.stepIndex += 1;
      st.anchorElapsed = live.elapsedSec;
      st.anchorDistance = live.distanceM;
      st.lastCountdown = 0;
      const next = clampedStepAt(steps, st.stepIndex);
      if (next) onAdvance?.(next);
    }
    forceRender();
  }, [enabled, steps, sessionKey, onAdvance, onComplete, forceRender]);

  // --- Build the view from current progress + live metrics ---
  if (!enabled || steps.length === 0) {
    return emptyView(steps.length);
  }
  const total = steps.length;

  if (!renderProgress.started) {
    const first = clampedStepAt(steps, 0);
    const { unit, value } = first ? targetOf(first) : ({ unit: "OPEN", value: null } as const);
    return {
      active: true,
      notStarted: true,
      completed: false,
      stepIndex: 0,
      total,
      current: first,
      next: optionalStepAt(steps, 1),
      unit,
      doneValue: 0,
      targetValue: value,
      remainingValue: value,
      progressRatio: 0,
      skip
    };
  }

  if (renderProgress.completed) {
    return {
      active: true,
      notStarted: false,
      completed: true,
      stepIndex: total,
      total,
      current: null,
      next: null,
      unit: "OPEN",
      doneValue: 0,
      targetValue: null,
      remainingValue: null,
      progressRatio: 1,
      skip
    };
  }

  const current = clampedStepAt(steps, renderProgress.stepIndex);
  const { unit, value } = current ? targetOf(current) : ({ unit: "OPEN", value: null } as const);
  const done = !current
    ? 0
    : unit === "TIME"
      ? Math.max(0, elapsedSec - renderProgress.anchorElapsed)
      : unit === "DISTANCE"
        ? Math.max(0, distanceM - renderProgress.anchorDistance)
        : 0;
  const remainingValue = value === null ? null : Math.max(0, value - done);
  const progressRatio = value ? Math.min(1, done / value) : 0;

  return {
    active: true,
    notStarted: false,
    completed: false,
    stepIndex: renderProgress.stepIndex,
    total,
    current,
    next: optionalStepAt(steps, renderProgress.stepIndex + 1),
    unit,
    doneValue: done,
    targetValue: value,
    remainingValue,
    progressRatio,
    skip
  };
}

function emptyView(total: number): GuidanceView {
  return {
    active: false,
    notStarted: false,
    completed: false,
    stepIndex: 0,
    total,
    current: null,
    next: null,
    unit: "OPEN",
    doneValue: 0,
    targetValue: null,
    remainingValue: null,
    progressRatio: 0,
    skip: () => {}
  };
}
