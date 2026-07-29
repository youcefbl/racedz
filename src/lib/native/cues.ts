import { Capacitor, registerPlugin } from "@capacitor/core";
import { notifyHaptic, tapHaptic } from "@/lib/native/haptics";
import type { CoachLocale } from "@/components/coach/types";
import { describeTarget, roleLabel, type ExecStep } from "@/lib/coach/workout-structure";

// Multi-sensory cues for guided workouts: a short tone (Web Audio), a spoken announcement, and a
// haptic buzz. Speech goes through native TTS on the APK (the Android WebView has no
// window.speechSynthesis) and falls back to Web Speech in a browser/PWA. When neither has a
// usable voice for the runner's language installed — a common case on Android when the TTS
// language pack is missing — speech falls back again to server-generated cloud audio (see
// speakWithCloudFallback below), so cues still speak without asking the runner to install
// anything. Every layer is best-effort and degrades silently — on a device with no audio/speech
// at all the haptic still fires, and none of it ever throws into the recorder. Audio must be
// unlocked by a user gesture first (call `primeCues()` from the Start button).
//
// There is deliberately NO music integration here: no playback, no ducking, no player control.
// The voice + tones + haptics are the audio experience; music playback is intentionally out of scope.

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

type ZidRunSpeechPlugin = {
  speak(options: { text: string; lang: string; rate: number; pitch: number; volume: number }): Promise<void>;
};

// New Android shells use the app-owned restartable engine. If the hosted web app
// is opened by an older APK where this plugin does not exist, playback falls back
// to the community plugin so server deploys remain backward-compatible.
const ZidRunSpeech = registerPlugin<ZidRunSpeechPlugin>("ZidRunSpeech");

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
  if (nativeLanguages !== null) return nativeLanguages;
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
    // Android creates its TTS engine asynchronously. Do not cache an early
    // "not initialized" failure as an empty language list for the whole app
    // session; a later retry should be allowed to discover the installed voices.
    return [];
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

function speakWeb(text: string, locale: CoachLocale, onFail?: () => void): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onFail?.();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = SPEECH_LANG[locale] === "ar" ? "ar-SA" : SPEECH_LANG[locale];
    utter.rate = 1;
    utter.volume = 1;
    if (onFail) utter.onerror = () => onFail();
    // Cancel anything queued so a fast transition doesn't stack announcements.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    onFail?.();
  }
}

// ---------------------------------------------------------------------------------------------
// Cloud voice fallback: server-generated speech for when neither native TTS nor Web Speech has a
// usable voice for the runner's language (or fails outright). Buffers are decoded through the
// same AudioContext the tones use — reusing it (rather than an <audio> element) means playback
// rides on the gesture-unlock `primeCues()` already did, with no separate autoplay policy to
// fight mid-run. Fetched/decoded buffers are cached in memory per (locale, text) for the life of
// the page; the server disk-caches the generated MP3 too, so repeat phrases across runs/runners
// don't re-hit OpenAI.
// ---------------------------------------------------------------------------------------------

const ttsBufferCache = new Map<string, Promise<AudioBuffer | null>>();

function ttsCacheKey(locale: CoachLocale, text: string): string {
  return `${locale}::${text}`;
}

function fetchTtsBuffer(text: string, locale: CoachLocale): Promise<AudioBuffer | null> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve(null);

  const key = ttsCacheKey(locale, text);
  const cached = ttsBufferCache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    try {
      const res = await fetch(`/api/coach/tts?locale=${locale}&text=${encodeURIComponent(text)}`);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch {
      return null;
    }
  })().then((buffer) => {
    if (!buffer) ttsBufferCache.delete(key); // let a later retry succeed once network/API recovers
    return buffer;
  });

  ttsBufferCache.set(key, pending);
  return pending;
}

function playBuffer(buffer: AudioBuffer): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  } catch {
    /* ignore */
  }
}

async function speakWithCloudFallback(text: string, locale: CoachLocale): Promise<VoicePlaybackResult> {
  const buffer = await fetchTtsBuffer(text, locale);
  if (!buffer) return { ok: false, code: "unavailable" };
  playBuffer(buffer);
  return { ok: true, code: "played" };
}

/**
 * Warms the cloud-voice cache for a set of cue phrases before a guided run starts (call
 * alongside `primeCues()` from the Start button, once the workout's steps are known). Native TTS
 * is tried first and is usually free/instant, so this is a pure safety net: if it turns out to be
 * unavailable mid-run, the cloud audio is already fetched and decoded, not a fresh network
 * round-trip. Best-effort and silent — a prefetch failure just means that fallback path will
 * retry live later.
 */
export function prefetchCloudSpeech(texts: readonly string[], locale: CoachLocale): void {
  if (typeof window === "undefined") return;
  const unique = new Set(texts.map((text) => text.trim()).filter(Boolean));
  for (const text of unique) {
    void fetchTtsBuffer(text, locale);
  }
}

export type VoicePlaybackResult =
  | { ok: true; code: "played" }
  | { ok: false; code: "unavailable" | "failed"; reason?: string };

const TTS_INIT_RETRY_MS = [0, 250, 600, 1200] as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "";
}

function isInitializationError(error: unknown): boolean {
  return /not (?:yet )?initialized|not available|initialization timed out|failed to initialize/i.test(errorText(error));
}

async function speakNative(text: string, locale: CoachLocale): Promise<VoicePlaybackResult> {
  const mod = loadTts();
  if (!mod) return { ok: false, code: "unavailable" };

  for (let attempt = 0; attempt < TTS_INIT_RETRY_MS.length; attempt += 1) {
    if (TTS_INIT_RETRY_MS[attempt] > 0) await delay(TTS_INIT_RETRY_MS[attempt]);
    try {
      const { TextToSpeech } = await mod;
      const supported = await loadNativeLanguages();
      const lang = resolveNativeLang(locale, supported);
      if (!lang) return { ok: false, code: "unavailable" };
      // Newest cue wins: the plugin's default queue strategy is FLUSH, which stops any in-flight
      // utterance when a new one arrives — no separate stop() round-trip needed.
      try {
        await ZidRunSpeech.speak({ text, lang, rate: 1.0, pitch: 1.0, volume: 1.0 });
      } catch (error) {
        if (!/not implemented|does not have an implementation/i.test(errorText(error))) throw error;
        await TextToSpeech.speak({ text, lang, rate: 1.0, pitch: 1.0, volume: 1.0 });
      }
      return { ok: true, code: "played" };
    } catch (error) {
      // A tap can arrive before Android's TTS OnInit callback. Retry only that
      // transient case; unsupported languages and genuine playback failures are
      // returned immediately so the settings UI can explain what happened.
      const reason = errorText(error);
      if (isInitializationError(error)) {
        if (attempt < TTS_INIT_RETRY_MS.length - 1) continue;
        return { ok: false, code: "unavailable", reason };
      }
      if (/language is not supported|unsupported language/i.test(reason)) {
        return { ok: false, code: "unavailable", reason };
      }
      return { ok: false, code: "failed", reason };
    }
  }
  return { ok: false, code: "failed" };
}

function logNativePlayback(text: string, locale: CoachLocale, result: VoicePlaybackResult): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[ZidRun TTS]", { locale, text, result });
  }
}

function speakWebAwaitable(text: string, locale: CoachLocale): Promise<VoicePlaybackResult> {
  return new Promise((resolve) => {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve({ ok: false, code: "unavailable" });
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = SPEECH_LANG[locale] === "ar" ? "ar-SA" : SPEECH_LANG[locale];
      utter.rate = 1;
      utter.volume = 1;
      utter.onend = () => resolve({ ok: true, code: "played" });
      utter.onerror = (event) => resolve({ ok: false, code: "failed", reason: event.error });
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (error) {
      resolve({ ok: false, code: "failed", reason: errorText(error) });
    }
  });
}

/**
 * Plays the pre-run voice sample and reports a result for visible UI feedback. Tries the
 * device's own voice first (native TTS / Web Speech); if that's unavailable or fails — the
 * "no voice installed for this language" case — falls back to cloud-generated audio so the test
 * (and real cues) still play without asking the runner to install anything.
 */
export async function playVoiceSample(text: string, locale: CoachLocale): Promise<VoicePlaybackResult> {
  if (!text) return { ok: false, code: "failed" };
  if (Capacitor.isNativePlatform()) {
    const result = await speakNative(text, locale);
    logNativePlayback(text, locale, result);
    if (result.ok) return result;
    const cloud = await speakWithCloudFallback(text, locale);
    return cloud.ok ? cloud : result;
  }
  const result = await speakWebAwaitable(text, locale);
  if (result.ok) return result;
  const cloud = await speakWithCloudFallback(text, locale);
  return cloud.ok ? cloud : result;
}

/** Opens Android's TTS data/voice installer when the selected language is missing. */
export async function openVoiceInstall(): Promise<boolean> {
  const mod = loadTts();
  if (!mod) return false;
  try {
    const { TextToSpeech } = await mod;
    await TextToSpeech.openInstall();
    nativeLanguages = null;
    return true;
  } catch {
    return false;
  }
}

/**
 * Speak one short cue in the runner's language, honoring the cue-density preference.
 * `level` declares what kind of cue this is: "essential" (step transitions, finish) survives the
 * reduced density; "full" (splits, pace guidance, check-ins) only plays on full guidance.
 */
export function speakCue(text: string, locale: CoachLocale, level: SpeechLevel = "full"): void {
  if (!text || !speechAllowed(level)) return;
  if (Capacitor.isNativePlatform()) {
    void speakNative(text, locale).then((result) => {
      logNativePlayback(text, locale, result);
      if (!result.ok) void speakWithCloudFallback(text, locale);
    });
  } else {
    speakWeb(text, locale, () => void speakWithCloudFallback(text, locale));
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
  speakCue(stepPhrase(step, locale), locale, "essential");
}

function completePhrase(locale: CoachLocale): string {
  return locale === "fr" ? "Séance terminée" : locale === "ar" ? "انتهت الحصة" : "Workout complete";
}

// The final "you're done" flourish when the last structured step completes.
export function announceComplete(locale: CoachLocale): void {
  beep(720, 180, 3);
  notifyHaptic("success");
  speakCue(completePhrase(locale), locale, "essential");
}

/**
 * Warms the cloud-voice cache for an entire guided workout's cues in one go — call once the
 * steps are known, alongside `primeCues()` from the Start button (see run-recorder.tsx). Covers
 * every step announcement plus the finish phrase, so if native/Web Speech turns out to have no
 * voice for this language, the fallback audio is already fetched before it's needed mid-run.
 */
export function prefetchGuidedWorkoutAudio(steps: readonly ExecStep[], locale: CoachLocale): void {
  const texts = steps.map((step) => stepPhrase(step, locale));
  texts.push(completePhrase(locale));
  prefetchCloudSpeech(texts, locale);
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
