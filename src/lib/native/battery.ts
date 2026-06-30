import { Capacitor, registerPlugin } from "@capacitor/core";

// Thin wrapper over the app-local BatteryOptimization native plugin
// (android/.../BatteryOptimizationPlugin.java). Lets the run recorder ask Android
// to exempt ZidRun from Doze/battery optimization so the GPS foreground service
// keeps running with the screen off. No-op on the web.
interface BatteryOptimizationPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<{ ignoring: boolean }>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>("BatteryOptimization");

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const result = await BatteryOptimization.isIgnoringBatteryOptimizations();
    return Boolean(result?.ignoring);
  } catch {
    return false;
  }
}

// Opens the system dialog. Resolves immediately with the pre-dialog state — the
// caller should re-check isIgnoringBatteryOptimizations() once the app resumes.
export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const result = await BatteryOptimization.requestIgnoreBatteryOptimizations();
    return Boolean(result?.ignoring);
  } catch {
    return false;
  }
}
