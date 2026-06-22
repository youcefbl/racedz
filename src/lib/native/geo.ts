import { Capacitor, registerPlugin } from "@capacitor/core";

// Minimal typings for @capacitor-community/background-geolocation.
type WatcherLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  bearing: number | null;
  time: number | null;
};

type WatcherError = { code?: string; message?: string };

type AddWatcherOptions = {
  backgroundMessage?: string;
  backgroundTitle?: string;
  requestPermissions?: boolean;
  stale?: boolean;
  distanceFilter?: number;
};

interface BackgroundGeolocationPlugin {
  addWatcher(options: AddWatcherOptions, callback: (location?: WatcherLocation, error?: WatcherError) => void): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export type LivePoint = {
  lat: number;
  lng: number;
  ele: number | null;
  t: number;
  speed: number | null;
  accuracy: number | null;
};

export function isNativeRuntime(): boolean {
  return Capacitor.isNativePlatform();
}

/** Start a background-aware location watcher. Returns the watcher id (pass to stopRunWatch). */
export async function startRunWatch(
  onPoint: (point: LivePoint) => void,
  onError: (error: WatcherError) => void
): Promise<string> {
  return BackgroundGeolocation.addWatcher(
    {
      backgroundMessage: "Recording your run. Tap to return to RaceDZ.",
      backgroundTitle: "RaceDZ — run in progress",
      requestPermissions: true,
      stale: false,
      distanceFilter: 5
    },
    (location, error) => {
      if (error) {
        onError(error);
        return;
      }
      if (!location) return;
      onPoint({
        lat: location.latitude,
        lng: location.longitude,
        ele: location.altitude ?? null,
        t: location.time ?? Date.now(),
        speed: location.speed ?? null,
        accuracy: location.accuracy ?? null
      });
    }
  );
}

export async function stopRunWatch(id: string): Promise<void> {
  try {
    await BackgroundGeolocation.removeWatcher({ id });
  } catch {
    // watcher may already be gone
  }
}

export async function openLocationSettings(): Promise<void> {
  try {
    await BackgroundGeolocation.openSettings();
  } catch {
    // best effort
  }
}

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in meters between two coordinates. */
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
