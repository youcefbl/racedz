import type { RunRoutePoint } from "@/components/coach/types";
import { haversineMeters, startRunWatch, stopRunWatch, type LivePoint } from "@/lib/native/geo";
import { clearActiveRun, loadActiveRun, saveActiveRun, type ActiveRunSnapshot } from "@/lib/native/run-store";
import { startStepCounter, stopStepCounter } from "@/lib/native/step-counter";

// Module-level run-recording engine. The GPS watcher, ticker, step counter and all
// derived metrics live here — NOT in the React component — so an in-progress run
// keeps recording when the user navigates away from the Runs tab (which unmounts the
// recorder) and is restored intact when they come back. The component is a thin view
// that subscribes to state changes and calls these methods.

export type RunStatus = "idle" | "tracking" | "paused" | "finished";

// "NOT_AUTHORIZED" = location permission missing; "GPS" = generic watcher failure.
export type RunErrorCode = "NOT_AUTHORIZED" | "GPS" | null;

const MAX_ROUTE_POINTS = 1500;
// Persist the in-progress run to device storage at most this often (ms).
const SNAPSHOT_INTERVAL_MS = 4000;
// Ignore the gap between two fixes when summing moving time if it's this long —
// it usually means GPS was lost, not that the runner was moving the whole time.
const MAX_MOVING_GAP_S = 15;

export type RunEngineState = {
  status: RunStatus;
  distanceM: number;
  elapsedSec: number;
  movingSec: number;
  elevationM: number;
  currentPace: number | null;
  gpsAccuracy: number | null;
  pointCount: number;
  effort: number;
  share: boolean;
  avgCadence: number | null;
  errorCode: RunErrorCode;
};

export type RunSavePayload = {
  startedAt: string;
  distanceKm: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  elevationGainM: number;
  avgCadence?: number;
  perceivedEffort: number;
  source: "GPS";
  isPublic: boolean;
  route: RunRoutePoint[];
};

class RunEngine {
  private status: RunStatus = "idle";
  private route: RunRoutePoint[] = [];
  private lastPoint: LivePoint | null = null;
  private distance = 0;
  private elevation = 0;
  private moving = 0; // float seconds, summed from GPS timestamps
  private lastPointTs = 0;
  private startTs = 0;
  private pausedAccum = 0;
  private pauseStart = 0;
  private lastSnapshotTs = 0;
  private effort = 5;
  private share = false;
  private elapsedSec = 0;
  private currentPace: number | null = null;
  private gpsAccuracy: number | null = null;
  private avgCadence: number | null = null;
  private cadenceTracking = false;
  private errorCode: RunErrorCode = null;

  private watcherId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private restoring = false;
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  getState(): RunEngineState {
    return {
      status: this.status,
      distanceM: this.distance,
      elapsedSec: this.elapsedSec,
      movingSec: Math.round(this.moving),
      elevationM: this.elevation,
      currentPace: this.currentPace,
      gpsAccuracy: this.gpsAccuracy,
      pointCount: this.route.length,
      effort: this.effort,
      share: this.share,
      avgCadence: this.avgCadence,
      errorCode: this.errorCode
    };
  }

  // Same array reference across calls; slice it in the component keyed on pointCount.
  getRoute(): RunRoutePoint[] {
    return this.route;
  }

  // Called when the recorder mounts. If a run is already live in memory (e.g. the user
  // navigated away and back) this is a no-op beyond re-notifying. On a cold start it
  // restores a persisted run as *paused* so the user can resume or save it — recording
  // never silently restarts without the GPS watcher the user can see.
  async init() {
    if (this.status !== "idle" || this.restoring) {
      this.emit();
      return;
    }
    this.restoring = true;
    try {
      const snapshot = await loadActiveRun();
      if (snapshot && snapshot.route.length > 1 && snapshot.distanceM > 50) {
        this.restoreFrom(snapshot);
      } else if (snapshot) {
        await clearActiveRun();
      }
    } finally {
      this.restoring = false;
      this.emit();
    }
  }

  private restoreFrom(snapshot: ActiveRunSnapshot) {
    this.startTs = snapshot.startTs;
    this.pausedAccum = snapshot.pausedAccum;
    this.distance = snapshot.distanceM;
    this.elevation = snapshot.elevationM;
    this.moving = snapshot.movingSec;
    this.lastPointTs = snapshot.lastPointTs;
    this.route = snapshot.route;
    this.effort = snapshot.effort;
    this.share = snapshot.share;
    const last = snapshot.route[snapshot.route.length - 1];
    this.lastPoint = last
      ? { lat: last.lat, lng: last.lng, ele: last.ele ?? null, t: last.t ?? snapshot.lastPointTs, speed: null, accuracy: null }
      : null;
    this.elapsedSec = Math.floor((Date.now() - snapshot.startTs - snapshot.pausedAccum) / 1000);
    this.currentPace = null;
    // The original GPS watcher is gone; enter paused so resuming restarts it and the
    // time the app was dead is treated as paused, not counted toward elapsed.
    this.pauseStart = Date.now();
    this.status = "paused";
  }

  async start() {
    this.errorCode = null;
    await clearActiveRun();
    this.route = [];
    this.lastPoint = null;
    this.distance = 0;
    this.elevation = 0;
    this.moving = 0;
    this.lastPointTs = 0;
    this.startTs = Date.now();
    this.pausedAccum = 0;
    this.lastSnapshotTs = 0;
    this.elapsedSec = 0;
    this.currentPace = null;
    this.gpsAccuracy = null;
    this.avgCadence = null;
    try {
      await this.beginWatch();
      // Best-effort: start counting steps for cadence. Never blocks the run.
      this.cadenceTracking = await startStepCounter();
      this.status = "tracking";
    } catch {
      this.errorCode = "GPS";
    }
    this.emit();
  }

  pause() {
    this.pauseStart = Date.now();
    this.status = "paused";
    this.persist("paused");
    this.emit();
  }

  async resume() {
    // The watcher may have been torn down (cold-start recovery); restart it if needed.
    if (!this.watcherId) {
      try {
        await this.beginWatch();
      } catch {
        this.errorCode = "GPS";
        this.emit();
        return;
      }
    }
    this.pausedAccum += Date.now() - this.pauseStart;
    this.status = "tracking";
    this.persist("tracking");
    this.emit();
  }

  async finish() {
    if (this.status === "paused") {
      this.pausedAccum += Date.now() - this.pauseStart;
    }
    this.elapsedSec = Math.floor((Date.now() - this.startTs - this.pausedAccum) / 1000);
    await this.stopWatch();
    // Average cadence = total steps / moving minutes (spm). Best-effort; null if the
    // step sensor wasn't available or captured nothing.
    if (this.cadenceTracking) {
      const steps = await stopStepCounter();
      this.cadenceTracking = false;
      const movingMin = this.moving / 60;
      const cadence = steps > 0 && movingMin > 0.5 ? Math.round(steps / movingMin) : null;
      this.avgCadence = cadence && cadence > 0 && cadence <= 300 ? cadence : null;
    }
    this.status = "finished";
    this.persist("paused"); // keep recoverable if the app dies on the summary screen
    this.emit();
  }

  discard() {
    void this.stopWatch();
    if (this.cadenceTracking) {
      void stopStepCounter();
      this.cadenceTracking = false;
    }
    void clearActiveRun();
    this.reset();
    this.emit();
  }

  setEffort(value: number) {
    this.effort = value;
    this.emit();
  }

  setShare(value: boolean) {
    this.share = value;
    this.emit();
  }

  getSavePayload(): RunSavePayload {
    const distanceKm = this.distance / 1000;
    return {
      startedAt: new Date(this.startTs).toISOString(),
      distanceKm: Number(distanceKm.toFixed(3)),
      durationSeconds: this.elapsedSec,
      movingTimeSeconds: Math.round(this.moving),
      elevationGainM: Math.round(this.elevation),
      avgCadence: this.avgCadence ?? undefined,
      perceivedEffort: this.effort,
      source: "GPS",
      isPublic: this.share,
      route: downsample(this.route, MAX_ROUTE_POINTS)
    };
  }

  // Clear the run after it has been saved (or queued offline) and return to idle.
  async markSaved() {
    await clearActiveRun();
    this.reset();
    this.emit();
  }

  // Force-write the current snapshot (e.g. when the app goes to the background).
  persistNow() {
    if (this.status === "tracking" || this.status === "paused") this.persist();
  }

  private reset() {
    this.status = "idle";
    this.route = [];
    this.lastPoint = null;
    this.distance = 0;
    this.elevation = 0;
    this.moving = 0;
    this.lastPointTs = 0;
    this.startTs = 0;
    this.pausedAccum = 0;
    this.elapsedSec = 0;
    this.currentPace = null;
    this.gpsAccuracy = null;
    this.avgCadence = null;
    this.errorCode = null;
  }

  private onPoint = (point: LivePoint) => {
    if (this.status !== "tracking") return;
    this.gpsAccuracy = point.accuracy ?? null;
    if (point.accuracy != null && point.accuracy > 40) {
      this.emit();
      return; // too noisy
    }

    const prev = this.lastPoint;
    if (prev) {
      const d = haversineMeters(prev, point);
      if (d >= 1 && d <= 60) {
        this.distance += d;
        // Moving time summed from GPS timestamps — survives screen-off throttling.
        const dt = (point.t - prev.t) / 1000;
        if (dt > 0 && dt < MAX_MOVING_GAP_S) this.moving += dt;
        if (prev.ele != null && point.ele != null) {
          const delta = point.ele - prev.ele;
          if (delta > 1) this.elevation += delta;
        }
        if (this.route.length < 100000) this.route.push({ lat: point.lat, lng: point.lng, ele: point.ele, t: point.t });
        this.lastPointTs = point.t;
      }
    } else {
      this.route.push({ lat: point.lat, lng: point.lng, ele: point.ele, t: point.t });
      this.lastPointTs = point.t;
    }
    this.lastPoint = point;

    this.currentPace = point.speed != null && point.speed > 0.4 ? Math.round(1000 / point.speed) : null;

    const now = Date.now();
    if (now - this.lastSnapshotTs > SNAPSHOT_INTERVAL_MS) {
      this.lastSnapshotTs = now;
      this.persist();
    }
    this.emit();
  };

  // Display-only ticker: refresh elapsed time while tracking. All persisted metrics
  // are derived from GPS timestamps, so a throttled ticker can't corrupt them.
  private tick = () => {
    if (this.status !== "tracking") return;
    this.elapsedSec = Math.floor((Date.now() - this.startTs - this.pausedAccum) / 1000);
    this.emit();
  };

  private async beginWatch() {
    this.errorCode = null;
    const id = await startRunWatch(this.onPoint, (err) => {
      this.errorCode = err.code === "NOT_AUTHORIZED" ? "NOT_AUTHORIZED" : "GPS";
      this.emit();
    });
    this.watcherId = id;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(this.tick, 1000);
  }

  private async stopWatch() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.watcherId) {
      await stopRunWatch(this.watcherId);
      this.watcherId = null;
    }
  }

  private persist(statusOverride?: "tracking" | "paused") {
    if (this.startTs === 0) return;
    const snapshot: ActiveRunSnapshot = {
      v: 1,
      status: statusOverride ?? (this.status === "paused" ? "paused" : "tracking"),
      startTs: this.startTs,
      pausedAccum: this.pausedAccum,
      distanceM: this.distance,
      elevationM: this.elevation,
      movingSec: this.moving,
      lastPointTs: this.lastPointTs,
      effort: this.effort,
      share: this.share,
      route: this.route,
      updatedAt: Date.now()
    };
    void saveActiveRun(snapshot);
  }
}

function downsample(points: RunRoutePoint[], max: number): RunRoutePoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: RunRoutePoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

// Single instance shared across the app for the lifetime of the WebView.
export const runEngine = new RunEngine();
