import { notifyHaptic, tapHaptic } from "@/lib/native/haptics";
import type { CoachLocale } from "@/components/coach/types";
import { describeTarget, roleLabel, type ExecStep } from "@/lib/coach/workout-structure";

// Multi-sensory cues for guided workouts: a short tone (Web Audio), a spoken announcement
// (SpeechSynthesis), and a haptic buzz. Every layer is best-effort and degrades silently — on a
// device with no audio/speech the haptic still fires, and none of it ever throws into the recorder.
// Audio must be unlocked by a user gesture first (call `primeCues()` from the Start button).

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

// Call inside a user-gesture handler (e.g. the Start button) so the browser lets us play audio and
// speak later, mid-run, without a fresh gesture.
export function primeCues(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
  // Warm up speech on some engines by speaking an empty utterance.
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  } catch {
    /* ignore */
  }
}

// A short beep at a given pitch. `count` chirps in quick succession (used for countdown vs. go).
function beep(frequency: number, durationMs = 160, count = 1): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    for (let i = 0; i < count; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * (durationMs / 1000 + 0.06);
      const end = start + durationMs / 1000;
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    /* ignore */
  }
}

const SPEECH_LANG: Record<CoachLocale, string> = { en: "en-US", fr: "fr-FR", ar: "ar-SA" };

function speak(text: string, locale: CoachLocale): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = SPEECH_LANG[locale];
    utter.rate = 1;
    utter.volume = 1;
    // Cancel anything queued so a fast transition doesn't stack announcements.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    /* ignore */
  }
}

// Localized "now do X" phrase for a step announcement.
function stepPhrase(step: ExecStep, locale: CoachLocale): string {
  const role = roleLabel(step.role, locale);
  const target = describeTarget(step.target, locale);
  const open = step.target.type === "OPEN";
  const rep = step.rep ? ` ${step.rep.current}/${step.rep.total}` : "";
  if (locale === "fr") return open ? `${role}` : `${role}${rep}, ${target}`;
  if (locale === "ar") return open ? `${role}` : `${role}${rep}، ${target}`;
  return open ? `${role}` : `${role}${rep}, ${target}`;
}

// Announce the start of a new step: a "go" tone (higher pitch for hard efforts), a spoken cue, and a
// haptic buzz whose strength matches the effort.
export function announceStep(step: ExecStep, locale: CoachLocale): void {
  const hard = step.intensity === "HARD";
  beep(hard ? 880 : 620, 200, hard ? 2 : 1);
  tapHaptic(hard ? "heavy" : "medium");
  speak(stepPhrase(step, locale), locale);
}

// The final "you're done" flourish when the last structured step completes.
export function announceComplete(locale: CoachLocale): void {
  beep(720, 180, 3);
  notifyHaptic("success");
  speak(locale === "fr" ? "Séance terminée" : locale === "ar" ? "انتهت الحصة" : "Workout complete", locale);
}

// A tick for the last few seconds of a timed step (3, 2, 1). Quiet and quick — no speech.
export function countdownTick(secondsLeft: number): void {
  beep(secondsLeft <= 1 ? 760 : 520, 90, 1);
  tapHaptic("light");
}
