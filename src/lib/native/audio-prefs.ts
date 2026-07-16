import { Preferences } from "@capacitor/preferences";
import { setCueDensity, type CueDensity } from "@/lib/native/cues";

// Persisted audio-coaching preferences (audio plan, Phase D):
//  - cue density: how chatty the guided-run voice is (full / essential / tones)
//  - warm-up & cool-down guidance: optional spoken tips during those phases
// Stored via Capacitor Preferences (SharedPreferences on Android, localStorage on the web).
// Loading also applies the values to the in-memory gates, so callers just await loadAudioPrefs()
// (or the individual loaders) before a run.

const DENSITY_KEY = "zidrun.audioCueDensity";
const WARMUP_KEY = "zidrun.audioWarmupGuidance";
const VALUES: CueDensity[] = ["full", "essential", "tones"];

// In-memory mirror of the warm-up/cool-down toggle, so the coaching hook can read it synchronously
// on every tick (same pattern as the cue-density gate living in lib/native/cues).
let warmupGuidance = true;

export function isWarmupGuidanceEnabled(): boolean {
  return warmupGuidance;
}

export async function loadCueDensity(): Promise<CueDensity> {
  try {
    const { value } = await Preferences.get({ key: DENSITY_KEY });
    const density = VALUES.includes(value as CueDensity) ? (value as CueDensity) : "full";
    setCueDensity(density);
    return density;
  } catch {
    setCueDensity("full");
    return "full";
  }
}

export async function saveCueDensity(density: CueDensity): Promise<void> {
  setCueDensity(density); // apply immediately — persistence is best-effort
  try {
    await Preferences.set({ key: DENSITY_KEY, value: density });
  } catch {
    /* storage unavailable — the in-memory gate still holds for this session */
  }
}

export async function loadWarmupGuidance(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: WARMUP_KEY });
    warmupGuidance = value !== "off"; // default on
  } catch {
    warmupGuidance = true;
  }
  return warmupGuidance;
}

export async function saveWarmupGuidance(enabled: boolean): Promise<void> {
  warmupGuidance = enabled;
  try {
    await Preferences.set({ key: WARMUP_KEY, value: enabled ? "on" : "off" });
  } catch {
    /* storage unavailable — the in-memory flag still holds for this session */
  }
}

/** Load every audio pref and apply it (called from the recorder on mount). */
export async function loadAudioPrefs(): Promise<{ density: CueDensity; warmupGuidance: boolean }> {
  const [density, warmup] = await Promise.all([loadCueDensity(), loadWarmupGuidance()]);
  return { density, warmupGuidance: warmup };
}
