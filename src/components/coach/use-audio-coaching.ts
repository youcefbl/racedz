"use client";

import { useEffect } from "react";
import type { GuidanceView } from "@/components/coach/use-workout-guidance";
import type { CoachLocale } from "@/components/coach/types";
import {
  collectAudioCue,
  createAudioCoachState,
  getAudioProfile,
  type AudioProfileId
} from "@/lib/coach/audio-coaching";
import { audioCueText } from "@/lib/coach/audio-copy";
import { isWarmupGuidanceEnabled } from "@/lib/native/audio-prefs";
import { getCueDensity, paceTone, speakCue } from "@/lib/native/cues";

// Drives the audio coach during a guided run. Pure consumer: each engine tick is fed to the
// deterministic scheduler (lib/coach/audio-coaching), and whatever single cue it returns is spoken
// via the cue layer. Step announcements/countdowns stay with useWorkoutGuidance — this hook adds
// the profile commentary on top (splits, pace guidance, check-ins, milestones), which is why every
// cue here is spoken at the "full" density level. Pace cues also fire a directional tone so
// tones-only runners still get steering.

type LiveMetrics = {
  status: "idle" | "tracking" | "paused" | "finished";
  elapsedSec: number;
  distanceM: number;
  currentPace: number | null; // engine's live pace (latest GPS fix — NOT smoothed), sec/km
};

const sharedAudioState = { current: createAudioCoachState() };

export function useAudioCoaching(options: {
  enabled: boolean;
  profileId: AudioProfileId;
  locale: CoachLocale;
  metrics: LiveMetrics;
  guidance: GuidanceView;
  recentPaceSecondsPerKm?: number | null;
}) {
  const { enabled, profileId, locale, metrics, guidance, recentPaceSecondsPerKm } = options;
  // Module-scoped like the guidance progress: the scheduler's counters (km marks, fired
  // milestones, pace dwell) must survive a mid-run component remount or splits/milestones would
  // repeat or report nonsense times after a tab switch. Reset on idle covers run-to-run reuse.
  const stateRef = sharedAudioState;

  useEffect(() => {
    if (!enabled) return;

    // Fresh scheduler whenever a new run begins.
    if (metrics.status === "idle") {
      stateRef.current = createAudioCoachState();
      return;
    }
    // Once the structured session completes, the commentary stops entirely — the guidance hook's
    // "Workout complete" announcement must never be talked over (speech is newest-cue-wins), and
    // free-running past the end needs no coaching.
    if (metrics.status !== "tracking" || !guidance.active || guidance.notStarted || guidance.completed) return;

    const event = collectAudioCue(getAudioProfile(profileId), stateRef.current, {
      elapsedSec: metrics.elapsedSec,
      distanceM: metrics.distanceM,
      currentPaceSecPerKm: metrics.currentPace ?? null,
      recentPaceSecPerKm: recentPaceSecondsPerKm ?? null,
      step: guidance.current,
      stepRatio: guidance.progressRatio,
      stepRemainingSec: guidance.unit === "TIME" ? guidance.remainingValue : null,
      stepRemainingM: guidance.unit === "DISTANCE" ? guidance.remainingValue : null,
      warmupCooldownGuidance: isWarmupGuidanceEnabled()
    });
    if (!event) return;

    // Pace guidance is full-density commentary: at "essential" or "tones" the whole signal is
    // dropped — a directional beep with no spoken explanation would just be a mystery sound.
    if (event.kind === "pace") {
      if (getCueDensity() !== "full") return;
      paceTone(event.direction);
    }
    speakCue(audioCueText(event, profileId, locale), locale, "full");
  }, [enabled, profileId, locale, metrics, guidance, recentPaceSecondsPerKm]);
}
