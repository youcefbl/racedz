"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExecStep } from "@/lib/coach/workout-structure";

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

// Progress lives at module scope, not in a ref: the run engine is a singleton that keeps
// recording across screen changes, and this hook's host component remounts on every tab switch —
// a mid-run remount must resume the workout exactly where it was, not restart (or kill) it.
// Only one recorder is ever live at a time, and the idle reset below covers run-to-run reuse.
const sharedProgress: { current: Progress } = {
  current: { started: false, completed: false, stepIndex: 0, anchorElapsed: 0, anchorDistance: 0, lastCountdown: 0 }
};

export function useWorkoutGuidance(
  steps: ExecStep[],
  metrics: LiveMetrics,
  options: {
    enabled: boolean;
    onAdvance?: (step: ExecStep) => void; // fired when a NEW step becomes current (incl. the first)
    onComplete?: () => void; // fired once when the last step finishes
    onCountdown?: (secondsLeft: number) => void; // 3-2-1 on timed steps
  }
): GuidanceView {
  const { enabled, onAdvance, onComplete, onCountdown } = options;
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;
  const [, bump] = useState(0);
  const forceRender = useCallback(() => bump((v) => v + 1), []);

  const { status, elapsedSec, distanceM } = metrics;

  useEffect(() => {
    if (!enabled || steps.length === 0) return;
    const st = sharedProgress.current;

    // Reset when a fresh run begins (engine went back to idle).
    if (status === "idle") {
      if (st.started || st.completed) {
        sharedProgress.current = { started: false, completed: false, stepIndex: 0, anchorElapsed: 0, anchorDistance: 0, lastCountdown: 0 };
        forceRender();
      }
      return;
    }

    if (status !== "tracking" && status !== "paused") return; // finished: freeze

    // First tick after starting: anchor step 0 and announce it.
    if (!st.started) {
      st.started = true;
      st.stepIndex = 0;
      st.anchorElapsed = elapsedSec;
      st.anchorDistance = distanceM;
      st.lastCountdown = 0;
      onAdvance?.(steps[0]!);
      forceRender();
      return;
    }
    if (st.completed) return;

    // Advance through every step whose target is already satisfied (handles very short steps that
    // clear within one tick). OPEN steps never auto-complete — they wait for a manual skip.
    let changed = false;
    while (st.stepIndex < steps.length) {
      const step = steps[st.stepIndex]!;
      const { unit, value } = targetOf(step);
      if (value === null) break; // OPEN
      const done = unit === "TIME" ? elapsedSec - st.anchorElapsed : distanceM - st.anchorDistance;
      if (done < value) break;
      if (st.stepIndex === steps.length - 1) {
        st.completed = true;
        onComplete?.();
        changed = true;
        break;
      }
      st.stepIndex += 1;
      st.anchorElapsed = elapsedSec;
      st.anchorDistance = distanceM;
      st.lastCountdown = 0;
      onAdvance?.(steps[st.stepIndex]!);
      changed = true;
    }

    // 3-2-1 countdown on the current timed step.
    if (!st.completed) {
      const step = steps[st.stepIndex]!;
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

    if (changed) forceRender();
  }, [enabled, steps, status, elapsedSec, distanceM, onAdvance, onComplete, onCountdown, forceRender]);

  const skip = useCallback(() => {
    if (!enabled || steps.length === 0) return;
    const st = sharedProgress.current;
    if (!st.started || st.completed) return;
    const live = metricsRef.current;
    if (st.stepIndex === steps.length - 1) {
      st.completed = true;
      onComplete?.();
    } else {
      st.stepIndex += 1;
      st.anchorElapsed = live.elapsedSec;
      st.anchorDistance = live.distanceM;
      st.lastCountdown = 0;
      onAdvance?.(steps[st.stepIndex]!);
    }
    forceRender();
  }, [enabled, steps, onAdvance, onComplete, forceRender]);

  // --- Build the view from current progress + live metrics ---
  if (!enabled || steps.length === 0) {
    return emptyView(steps.length);
  }
  const st = sharedProgress.current;
  const total = steps.length;

  if (!st.started) {
    const first = steps[0]!;
    const { unit, value } = targetOf(first);
    return {
      active: true,
      notStarted: true,
      completed: false,
      stepIndex: 0,
      total,
      current: first,
      next: steps[1] ?? null,
      unit,
      doneValue: 0,
      targetValue: value,
      remainingValue: value,
      progressRatio: 0,
      skip
    };
  }

  if (st.completed) {
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

  const current = steps[st.stepIndex]!;
  const { unit, value } = targetOf(current);
  const done = unit === "TIME" ? Math.max(0, elapsedSec - st.anchorElapsed) : unit === "DISTANCE" ? Math.max(0, distanceM - st.anchorDistance) : 0;
  const remainingValue = value === null ? null : Math.max(0, value - done);
  const progressRatio = value ? Math.min(1, done / value) : 0;

  return {
    active: true,
    notStarted: false,
    completed: false,
    stepIndex: st.stepIndex,
    total,
    current,
    next: steps[st.stepIndex + 1] ?? null,
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
