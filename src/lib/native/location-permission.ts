import { Capacitor, registerPlugin } from "@capacitor/core";

// Wrapper over the app-local BackgroundLocation native plugin. Lets the run
// recorder detect whether the user granted location "Allow all the time" (needed
// to keep recording when the screen is off) and open settings to change it.
interface BackgroundLocationPlugin {
  check(): Promise<{ fine: boolean; background: boolean }>;
  openSettings(): Promise<void>;
}

const BackgroundLocation = registerPlugin<BackgroundLocationPlugin>("BackgroundLocation");

export type LocationPermissionState = { fine: boolean; background: boolean };

export async function checkBackgroundLocation(): Promise<LocationPermissionState> {
  if (!Capacitor.isNativePlatform()) return { fine: true, background: true };
  try {
    const result = await BackgroundLocation.check();
    return { fine: Boolean(result?.fine), background: Boolean(result?.background) };
  } catch {
    return { fine: false, background: false };
  }
}

export async function openLocationPermissionSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await BackgroundLocation.openSettings();
  } catch {
    /* best effort */
  }
}
