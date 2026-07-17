import { Capacitor } from "@capacitor/core";
import { notifyHaptic, tapHaptic } from "@/lib/native/haptics";
import type { CoachLocale } from "@/components/coach/types";
import { describeTarget, roleLabel, type ExecStep } from "@/lib/coach/workout-structure";

// Multi-sensory cues for guided workouts: a short tone (Web Audio), a spoken announcement, and a
// haptic buzz. Speech goes through native TTS on the APK (the Android WebView has no
// window.speechSynthesis) and falls back to Web Speech in a browser/PWA. Every layer is
// best-effort and degrades silently — on a device with no audio/speech the haptic still fires,
// and none of it ever throws into the recorder. Audio must be unlocked by a user gesture first
// (call `primeCues()` from the Start button).
//
// There is deliberately NO music integration here: no playback, no ducking, no player control.
// The voice + tones + haptics ARE the audio experience (see execution-plan-audio-coaching.md).

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

// ---------------------------------------------------------------------------------------------
// Cue density — one global gate over how chatty the audio coaching is. Set from the runner's
// stored preference (see audio-prefs) before/when a run starts; every speech call declares which
// level it belongs to and is dropped when the runner asked for less. Tones + haptics always fire.
//   full      — everything: steps, countdowns, splits, pace guidance, check-ins
//   essential — step transitions, countdowns, and the finish only
//   tones     — no speech at all
// ---------------------------------------------------------------------------------------------

export type CueDensity = "full" | "essential" | "tones";
export type SpeechLevel = "essential" | "full";

let cueDensity: CueDensity = "full";

export function setCueDensity(density: CueDensity): void {
  cueDensity = density;
}

export function getCueDensity(): CueDensity {
  return cueDensity;
}

function speechAllowed(level: SpeechLevel): boolean {
  if (cueDensity === "tones") return false;
  if (cueDensity === "essential") return level === "essential";
  return true;
}

// Call inside a user-gesture handler (e.g. the Start button) so the browser lets us play audio and
// speak later, mid-run, without a fresh gesture. Also warms the native TTS language check.
export function primeCues(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  } catch {
    /* ignore */
  }
  // Fire-and-forget: cache the supported-language list so mid-run speech doesn't wait on it.
  void loadNativeLanguages();
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

// ---------------------------------------------------------------------------------------------
// Speech adapter: native TTS on Capacitor, Web Speech in a browser, silence elsewhere.
// ---------------------------------------------------------------------------------------------

const SPEECH_LANG: Record<CoachLocale, string> = { en: "en-US", fr: "fr-FR", ar: "ar" };

type TtsModule = typeof import("@capacitor-community/text-to-speech");

let ttsModPromise: Promise<TtsModule> | null = null;

function loadTts(): Promise<TtsModule> | null {
  if (!Capacitor.isNativePlatform()) return null;
  if (!ttsModPromise) ttsModPromise = import("@capacitor-community/text-to-speech");
  return ttsModPromise;
}

// Supported-language tags reported by the device's TTS engine, lowercased ("en-US" → "en-us").
// null = not yet loaded; empty array = loaded but nothing/failed (treat as "try anyway").
let nativeLanguages: string[] | null = null;

async function loadNativeLanguages(): Promise<string[]> {
  if (nativeLanguages) return nativeLanguages;
  const mod = loadTts();
  if (!mod) {
    nativeLanguages = [];
    return nativeLanguages;
  }
  try {
    const { TextToSpeech } = await mod;
    const result = await TextToSpeech.getSupportedLanguages();
    nativeLanguages = (result.languages ?? []).map((lang) => lang.toLowerCase().replace("_", "-"));
  } catch {
    nativeLanguages = [];
  }
  return nativeLanguages;
}

// Best native language tag for a locale: exact match, then any tag with the same primary language
// ("ar" matches "ar-eg"), then null (no voice for this language on the device).
function resolveNativeLang(locale: CoachLocale, supported: string[]): string | null {
  const wanted = SPEECH_LANG[locale].toLowerCase();
  const primary = wanted.split("-")[0]!;
  if (supported.length === 0) return SPEECH_LANG[locale]; // unknown list — let the engine try
  if (supported.includes(wanted)) return SPEECH_LANG[locale];
  const prefixed = supported.find((lang) => lang === primary || lang.startsWith(`${primary}-`));
  return prefixed ?? null;
}

/**
 * Whether the runner's locale has a usable voice. On native this asks the TTS engine (e.g. Arabic
 * language data may not be installed); on the web it checks SpeechSynthesis exists. Used by the
 * audio settings to explain why voice cues are silent — playback itself just degrades quietly.
 */
export async function isVoiceAvailable(locale: CoachLocale): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const supported = await loadNativeLanguages();
    if (supported.length === 0) return true; // couldn't enumerate — assume the engine will cope
    return resolveNativeLang(locale, supported) !== null;
  }
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function speakWeb(text: string, locale: CoachLocale): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = SPEECH_LANG[locale] === "ar" ? "ar-SA" : SPEECH_LANG[locale];
    utter.rate = 1;
    utter.volume = 1;
    // Cancel anything queued so a fast transition doesn't stack announcements.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    /* ignore */
  }
}

function speakNative(text: string, locale: CoachLocale): void {
  const mod = loadTts();
  if (!mod) return;
  void (async () => {
    try {
      const { TextToSpeech } = await mod;
      const supported = await loadNativeLanguages();
      const lang = resolveNativeLang(locale, supported);
      if (!lang) return; // no voice for this language — tones + haptics carry the cue
      // Newest cue wins: the plugin's default queue strategy is FLUSH, which stops any in-flight
      // utterance when a new one arrives — no separate stop() round-trip needed.
      await TextToSpeech.speak({ text, lang, rate: 1.0, pitch: 1.0, volume: 1.0 });
    } catch {
      /* engine hiccup — stay silent, never throw into the recorder */
    }
  })();
}

/**
 * Speak one short cue in the runner's language, honoring the cue-density preference.
 * `level` declares what kind of cue this is: "essential" (step transitions, finish) survives the
 * reduced density; "full" (splits, pace guidance, check-ins) only plays on full guidance.
 */
export function speakCue(text: string, locale: CoachLocale, level: SpeechLevel = "full"): void {
  if (!text || !speechAllowed(level)) return;
  if (Capacitor.isNativePlatform()) speakNative(text, locale);
  else speakWeb(text, locale);
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
  speakCue(stepPhrase(step, locale), locale, "essential");
}

// The final "you're done" flourish when the last structured step completes.
export function announceComplete(locale: CoachLocale): void {
  beep(720, 180, 3);
  notifyHaptic("success");
  speakCue(locale === "fr" ? "Séance terminée" : locale === "ar" ? "انتهت الحصة" : "Workout complete", locale, "essential");
}

// A tick for the last few seconds of a timed step (3, 2, 1). Quiet and quick — no speech.
export function countdownTick(secondsLeft: number): void {
  beep(secondsLeft <= 1 ? 760 : 520, 90, 1);
  tapHaptic("light");
}

// Distinct two-tone signals for pace guidance, so "tones only" runners still get direction:
// rising = pick it up, falling = ease off.
export function paceTone(direction: "faster" | "slower"): void {
  if (direction === "faster") {
    beep(520, 120, 1);
    setTimeout(() => beep(760, 120, 1), 170);
  } else {
    beep(760, 120, 1);
    setTimeout(() => beep(520, 120, 1), 170);
  }
  tapHaptic("light");
}
