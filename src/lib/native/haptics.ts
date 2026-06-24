import { Capacitor } from "@capacitor/core";

// Thin wrapper over @capacitor/haptics. Every call is a no-op off-native and never throws,
// so UI code can fire feedback unconditionally without guarding the platform each time.
// The plugin is imported lazily so the web bundle doesn't pull it in.

type ImpactWeight = "light" | "medium" | "heavy";
type NotifyKind = "success" | "warning" | "error";

let modPromise: Promise<typeof import("@capacitor/haptics")> | null = null;

function load() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!modPromise) modPromise = import("@capacitor/haptics");
  return modPromise;
}

/** A short tap — use for taps, toggles, and selection changes. */
export function tapHaptic(weight: ImpactWeight = "light"): void {
  void (async () => {
    const mod = await load();
    if (!mod) return;
    try {
      await mod.Haptics.impact({ style: mod.ImpactStyle[weight === "heavy" ? "Heavy" : weight === "medium" ? "Medium" : "Light"] });
    } catch {
      /* haptics unavailable on this device — ignore */
    }
  })();
}

/** A success/warning/error buzz — use to confirm a completed action or flag a problem. */
export function notifyHaptic(kind: NotifyKind = "success"): void {
  void (async () => {
    const mod = await load();
    if (!mod) return;
    try {
      const type = kind === "error" ? mod.NotificationType.Error : kind === "warning" ? mod.NotificationType.Warning : mod.NotificationType.Success;
      await mod.Haptics.notification({ type });
    } catch {
      /* ignore */
    }
  })();
}
