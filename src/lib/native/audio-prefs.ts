import { Preferences } from "@capacitor/preferences";
import { setCueDensity, type CueDensity } from "@/lib/native/cues";

// Persisted audio-coaching preference (audio plan, Phase D): how chatty the guided-run voice is.
// One setting, three levels — full guidance / essential only / tones only — stored via Capacitor
// Preferences (SharedPreferences on Android, localStorage on the web). Loading also applies the
// value to the cue layer's global gate, so callers just await loadCueDensity() before a run.

const KEY = "zidrun.audioCueDensity";
const VALUES: CueDensity[] = ["full", "essential", "tones"];

export async function loadCueDensity(): Promise<CueDensity> {
  try {
    const { value } = await Preferences.get({ key: KEY });
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
    await Preferences.set({ key: KEY, value: density });
  } catch {
    /* storage unavailable — the in-memory gate still holds for this session */
  }
}
