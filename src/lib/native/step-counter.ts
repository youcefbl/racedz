import { Capacitor, registerPlugin } from "@capacitor/core";

// Thin wrapper over the app-local StepCounter native plugin
// (android/.../StepCounterPlugin.java). Lets the run recorder count steps during a
// run so it can report average cadence (steps/min). Best-effort and no-op on the web:
// if the device has no step sensor or the ACTIVITY_RECOGNITION grant is denied, the
// run is saved without cadence.
interface StepCounterPlugin {
  start(): Promise<{ available: boolean }>;
  getSteps(): Promise<{ steps: number; available: boolean }>;
  stop(): Promise<{ steps: number }>;
}

const StepCounter = registerPlugin<StepCounterPlugin>("StepCounter");

// Starts counting (requesting the ACTIVITY_RECOGNITION permission if needed).
// Resolves true only when a step sensor is present and permission is granted.
export async function startStepCounter(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await StepCounter.start();
    return Boolean(result?.available);
  } catch {
    return false;
  }
}

// Steps recorded since start(), without stopping the counter.
export async function readSteps(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  try {
    const result = await StepCounter.getSteps();
    return Math.max(0, Math.round(result?.steps ?? 0));
  } catch {
    return 0;
  }
}

// Stops counting and returns the final step total for the run.
export async function stopStepCounter(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  try {
    const result = await StepCounter.stop();
    return Math.max(0, Math.round(result?.steps ?? 0));
  } catch {
    return 0;
  }
}
