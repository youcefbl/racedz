import { Preferences } from "@capacitor/preferences";
import type { RunRoutePoint } from "@/components/coach/types";

// Durable snapshot of an in-progress run so a crash / OS-kill / accidental app
// close doesn't lose the recording. Written periodically while tracking and on
// every pause/resume; cleared when the run is saved or discarded.
const KEY = "zidrun:active-run";

export type ActiveRunSnapshot = {
  v: 1;
  status: "tracking" | "paused";
  startTs: number;
  pausedAccum: number;
  distanceM: number;
  elevationM: number;
  movingSec: number;
  lastPointTs: number;
  effort: number;
  share: boolean;
  route: RunRoutePoint[];
  updatedAt: number;
};

export async function saveActiveRun(snapshot: ActiveRunSnapshot): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(snapshot) });
  } catch {
    /* storage full / unavailable — recording continues from in-memory state */
  }
}

export async function loadActiveRun(): Promise<ActiveRunSnapshot | null> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return null;
    const parsed = JSON.parse(value) as ActiveRunSnapshot;
    if (parsed?.v !== 1 || !Array.isArray(parsed.route) || typeof parsed.startTs !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearActiveRun(): Promise<void> {
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    /* best effort */
  }
}
