import { Preferences } from "@capacitor/preferences";
import { parseActiveRunSnapshot, type ActiveRunSnapshot } from "@/lib/native/run-snapshot";

// Durable snapshot of an in-progress run so a crash / OS-kill / accidental app
// close doesn't lose the recording. Written periodically while tracking and on
// every pause/resume; cleared when the run is saved or discarded.
const LEGACY_KEY = "zidrun:active-run";
const keyForUser = (userId: string) => `${LEGACY_KEY}:${encodeURIComponent(userId)}`;

export type { ActiveRunSnapshot } from "@/lib/native/run-snapshot";

export async function saveActiveRun(snapshot: ActiveRunSnapshot): Promise<boolean> {
  try {
    await Preferences.set({ key: keyForUser(snapshot.userId), value: JSON.stringify(snapshot) });
    return true;
  } catch {
    return false;
  }
}

export async function loadActiveRun(userId: string): Promise<ActiveRunSnapshot | null> {
  try {
    const userKey = keyForUser(userId);
    const { value } = await Preferences.get({ key: userKey });
    if (value) {
      const snapshot = parseActiveRunSnapshot(value, userId);
      if (snapshot) return snapshot;
      // Only malformed data already isolated under this user's key is unrecoverable.
      await Preferences.remove({ key: userKey });
      return null;
    }

    // Migrate snapshots written by the previous single-key implementation only when they
    // explicitly name this account. Older unowned v1 data is deliberately left quarantined:
    // assigning it to the next account would leak a private route, while deleting it could lose
    // a legitimate run.
    const legacy = await Preferences.get({ key: LEGACY_KEY });
    if (!legacy.value) return null;
    const snapshot = parseActiveRunSnapshot(legacy.value, userId);
    if (!snapshot) return null;
    const migrated = await saveActiveRun(snapshot);
    if (!migrated) return null;
    await Preferences.remove({ key: LEGACY_KEY });
    return snapshot;
  } catch {
    return null;
  }
}

export async function clearActiveRun(userId: string): Promise<void> {
  try {
    await Preferences.remove({ key: keyForUser(userId) });
  } catch {
    /* best effort */
  }
}
