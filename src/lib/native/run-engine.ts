import type { RunRoutePoint } from "@/components/coach/types";
import { haversineMeters, startRunWatch, stopRunWatch, type LivePoint } from "@/lib/native/geo";
import { clearActiveRun, loadActiveRun, saveActiveRun, type ActiveRunSnapshot } from "@/lib/native/run-store";
import { advanceHighSpeedWindow, NON_FOOT_AUTO_PAUSE_SECONDS, restoreAsPausedTiming } from "@/lib/native/run-lifecycle";
import { isUsableGpsFix, shouldCountGpsSegment } from "@/lib/native/gps-quality";
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
  // 0 when idle. Doubles as a stable identity for the current run session (e.g. so guided-
  // workout progress can tell "a new run started" apart from "the same run resumed").
  startTs: number;
  distanceM: number;
  elapsedSec: number;
  movingSec: number;
  elevationM: number;
  currentPace: number | null;
  gpsAccuracy: number | null;
  pointCount: number;
  effort: number;
  share: boolean;
  title: string;
  description: string;
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
  title?: string;
  notes?: string;
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
  private title = "";
  private description = "";
  private elapsedSec = 0;
  private currentPace: number | null = null;
  private gpsAccuracy: number | null = null;
  private avgCadence: number | null = null;
  private cadenceTracking = false;
  private cadenceSteps = 0;
  private highSpeedSeconds = 0;
  private errorCode: RunErrorCode = null;
  // Set once init() knows who's logged in; stamped onto every persisted snapshot so a
  // different account on the same device is never offered someone else's recording.
  private userId: string | null = null;

  private watcherId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private restoring = false;
  private initPromise: Promise<void> | null = null;
  private nativeStopPromise: Promise<void> | null = null;
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

  // Elapsed time = wall time since start, minus manually-paused stretches. Wall clock advances
  // correctly whether the app is foregrounded, backgrounded, or the screen is off, so this stays
  // accurate under GPS throttling. We deliberately do NOT auto-subtract "stationary" time from the
  // wall clock: backgrounded GPS fixes arrive in delayed bursts, which the old auto-pause logic
  // mistook for standing still and cut real running time out of the total (a 31-min run showed 3:03).
  // "Stationary at a red light" time genuinely belongs in elapsed; moving time is tracked separately.
  private computeElapsedSec(): number {
    if (this.startTs === 0) return 0;
    return Math.max(0, Math.floor((Date.now() - this.startTs - this.pausedAccum) / 1000));
  }

  getState(): RunEngineState {
    return {
      status: this.status,
      startTs: this.startTs,
      distanceM: this.distance,
      elapsedSec: this.elapsedSec,
      movingSec: Math.round(this.moving),
      elevationM: this.elevation,
      currentPace: this.currentPace,
      gpsAccuracy: this.gpsAccuracy,
      pointCount: this.route.length,
      effort: this.effort,
      share: this.share,
      title: this.title,
      description: this.description,
      avgCadence: this.avgCadence,
      errorCode: this.errorCode
    };
  }

  // Same array reference across calls; slice it in the component keyed on pointCount.
  getRoute(): RunRoutePoint[] {
    return this.route;
  }

  // Called when the recorder mounts, with the currently-authenticated user. If a run is
  // already live in memory (e.g. the user navigated away and back) this is a no-op beyond
  // re-notifying. On a cold start it restores a persisted run as *paused* so the user can
  // resume, finish, or discard it — recording never silently restarts without the GPS
  // watcher the user can see, and an implausible-looking snapshot is never silently
  // deleted: it's restored like any other, and the existing "doesn't look like it was on
  // foot" warning + pause/finish/discard controls let the runner decide.
  async init(userId: string) {
    if (this.initPromise) await this.initPromise;
    if (this.userId && this.userId !== userId && this.status !== "idle") {
      // Defensive warm account switch: preserve the original owner's run before changing the
      // engine owner, then reset so the next account can only load its own per-user key.
      if (this.status === "tracking") this.pause();
      await this.stopNativeResources();
      await this.saveSnapshot("paused");
      this.reset();
    }
    this.userId = userId;
    if (this.status !== "idle") {
      this.emit();
      return;
    }
    this.restoring = true;
    this.initPromise = (async () => {
      try {
        const snapshot = await loadActiveRun(userId);
        if (!snapshot) return;
        try {
          // A native background watcher can outlive a WebView crash/reload. Its persisted id lets
          // the new runtime explicitly remove that orphan before presenting a safely paused run.
          if (snapshot.watcherId) await stopRunWatch(snapshot.watcherId);
          this.restoreFrom(snapshot);
        } catch {
          await clearActiveRun(userId);
          this.reset();
        }
      } finally {
        this.restoring = false;
        this.emit();
      }
    })();
    await this.initPromise.finally(() => {
      this.initPromise = null;
    });
  }

  private restoreFrom(snapshot: ActiveRunSnapshot) {
    const timing = restoreAsPausedTiming(snapshot, Date.now());
    this.startTs = snapshot.startTs;
    this.pausedAccum = timing.pausedAccum;
    this.distance = snapshot.distanceM;
    this.elevation = snapshot.elevationM;
    this.moving = snapshot.movingSec;
    this.lastPointTs = snapshot.lastPointTs;
    this.route = snapshot.route;
    this.effort = snapshot.effort;
    this.share = snapshot.share;
    this.title = snapshot.title ?? "";
    this.description = snapshot.description ?? "";
    this.cadenceSteps = snapshot.cadenceSteps ?? 0;
    this.highSpeedSeconds = 0;
    const last = snapshot.route[snapshot.route.length - 1];
    this.lastPoint = last
      ? { lat: last.lat, lng: last.lng, ele: last.ele ?? null, t: last.t ?? snapshot.lastPointTs, speed: null, accuracy: null }
      : null;
    this.elapsedSec = timing.elapsedSec;
    this.currentPace = null;
    // The original GPS watcher is gone; enter paused so resuming restarts it and the
    // time the app was dead is treated as paused, not counted toward elapsed.
    this.pauseStart = timing.pauseStart;
    this.status = "paused";
  }

  async start() {
    if (this.initPromise) await this.initPromise;
    if (this.status !== "idle" || !this.userId) return;
    this.errorCode = null;
    await clearActiveRun(this.userId);
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
    this.cadenceSteps = 0;
    this.highSpeedSeconds = 0;
    this.title = "";
    this.description = "";
    try {
      await this.beginWatch();
      this.status = "tracking";
      // Persist the watcher id immediately. If the WebView dies before the first GPS fix, the
      // next runtime can still remove the native foreground watcher instead of orphaning it.
      await this.saveSnapshot("tracking");
      // Best-effort: start counting steps for cadence. Never blocks the run.
      this.cadenceTracking = await startStepCounter();
    } catch {
      this.errorCode = "GPS";
    }
    this.emit();
  }

  pause() {
    if (this.status !== "tracking") return;
    this.pauseStart = Date.now();
    this.status = "paused";
    this.persist("paused");
    this.emit();
  }

  async resume() {
    if (this.status !== "paused") return;
    if (this.nativeStopPromise) await this.nativeStopPromise;
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
    if (!this.cadenceTracking) this.cadenceTracking = await startStepCounter();
    this.pausedAccum += Date.now() - this.pauseStart;
    this.status = "tracking";
    this.persist("tracking");
    this.emit();
  }

  async finish() {
    if (this.status === "paused") {
      this.pausedAccum += Date.now() - this.pauseStart;
    }
    this.elapsedSec = this.computeElapsedSec();
    await this.stopNativeResources();
    // Average cadence = total steps / moving minutes (spm). Best-effort; null if the
    // step sensor wasn't available or captured nothing.
    const movingMin = this.moving / 60;
    const cadence = this.cadenceSteps > 0 && movingMin > 0.5 ? Math.round(this.cadenceSteps / movingMin) : null;
    this.avgCadence = cadence && cadence > 0 && cadence <= 300 ? cadence : null;
    this.status = "finished";
    this.persist("paused"); // keep recoverable if the app dies on the summary screen
    this.emit();
  }

  discard() {
    void this.abortAndClear();
  }

  // Fully tears down every native/resource handle — GPS watcher, ticker, step counter —
  // and clears the persisted snapshot, awaited in that order, before resetting to idle.
  // Used by confirmed discard and by crash recovery: a bare storage-clear-and-reload is not
  // enough, because the GPS watcher is a native plugin (a real Android foreground service)
  // that outlives a WebView JS reload — only an explicit removeWatcher() call stops it.
  async abortAndClear(): Promise<void> {
    await this.stopNativeResources();
    if (this.userId) await clearActiveRun(this.userId);
    this.reset();
    this.emit();
  }

  // Logout must stop every native resource without deleting the runner's recoverable snapshot.
  // The next login restores it paused, with logged-out time excluded from elapsed duration.
  async pauseAndStopForSignOut(userId?: string): Promise<void> {
    if (userId) await this.init(userId);
    if (this.status === "tracking") this.pause();
    if (this.status !== "paused") return;
    await this.stopNativeResources();
    const preserved = await this.saveSnapshot("paused");
    if (!preserved) throw new Error("ACTIVE_RUN_SNAPSHOT_WRITE_FAILED");
  }

  setEffort(value: number) {
    this.effort = value;
    this.emit();
  }

  setShare(value: boolean) {
    this.share = value;
    this.emit();
  }

  setTitle(value: string) {
    this.title = value.slice(0, 120);
    this.emit();
  }

  setDescription(value: string) {
    this.description = value.slice(0, 2000);
    this.emit();
  }

  getSavePayload(): RunSavePayload {
    const distanceKm = this.distance / 1000;
    const movingSeconds = Math.round(this.moving);
    return {
      startedAt: new Date(this.startTs).toISOString(),
      distanceKm: Number(distanceKm.toFixed(3)),
      // Total (elapsed) time can never be less than moving time; clamp so any clock oddity can't
      // save the impossible "elapsed < moving" that this fix eliminates at the source.
      durationSeconds: Math.max(this.elapsedSec, movingSeconds),
      movingTimeSeconds: movingSeconds,
      elevationGainM: Math.round(this.elevation),
      avgCadence: this.avgCadence ?? undefined,
      perceivedEffort: this.effort,
      title: this.title.trim() || undefined,
      notes: this.description.trim() || undefined,
      source: "GPS",
      isPublic: this.share,
      route: downsample(this.route, MAX_ROUTE_POINTS)
    };
  }

  // Clear the run after it has been saved (or queued offline) and return to idle.
  async markSaved() {
    if (this.userId) await clearActiveRun(this.userId);
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
    this.cadenceSteps = 0;
    this.highSpeedSeconds = 0;
    this.title = "";
    this.description = "";
    this.errorCode = null;
  }

  private onPoint = (point: LivePoint) => {
    if (this.status !== "tracking") return;
    this.gpsAccuracy = point.accuracy ?? null;
    if (!isUsableGpsFix(point.accuracy)) {
      this.emit();
      return; // too noisy
    }

    const prev = this.lastPoint;
    if (prev) {
      const d = haversineMeters(prev, point);
      const dt = (point.t - prev.t) / 1000;
      const speedDistance = point.speed != null && point.speed >= 0 && dt > 0 ? point.speed * dt : d;
      this.highSpeedSeconds = advanceHighSpeedWindow(this.highSpeedSeconds, speedDistance, dt);
      const countSegment = shouldCountGpsSegment({
        distanceM: d,
        elapsedSeconds: dt,
        reportedSpeedMps: point.speed,
        recordingAgeSeconds: Math.max(0, (point.t - this.startTs) / 1000)
      });
      if (countSegment) {
        this.distance += d;
        // Moving time summed from GPS timestamps — survives screen-off throttling.
        if (dt > 0 && dt < MAX_MOVING_GAP_S) this.moving += dt;
        if (prev.ele != null && point.ele != null) {
          const delta = point.ele - prev.ele;
          if (delta > 1) this.elevation += delta;
        }
        this.appendRoutePoint({ lat: point.lat, lng: point.lng, ele: point.ele, t: point.t });
        this.lastPointTs = point.t;
      } else if (this.distance === 0 && this.route.length === 1) {
        // While the runner is still stationary, keep replacing the acquisition fix instead
        // of saving its drift as the beginning of the route. The first real movement is then
        // measured from the latest settled position.
        this.route[0] = { lat: point.lat, lng: point.lng, ele: point.ele, t: point.t };
        this.lastPointTs = point.t;
      }
    } else {
      this.appendRoutePoint({ lat: point.lat, lng: point.lng, ele: point.ele, t: point.t });
      this.lastPointTs = point.t;
    }
    this.lastPoint = point;

    this.currentPace = point.speed != null && point.speed > 0.4 ? Math.round(1000 / point.speed) : null;

    // Two consecutive minutes above plausible foot speed auto-pauses and tears down native
    // tracking. This is a rolling segment window, not the lifetime average, so a drive after a
    // legitimate long run is caught promptly without deleting the activity.
    if (this.highSpeedSeconds >= NON_FOOT_AUTO_PAUSE_SECONDS) {
      this.pause();
      void this.stopNativeResources().then(() => this.saveSnapshot("paused"));
      return;
    }

    const now = Date.now();
    if (now - this.lastSnapshotTs > SNAPSHOT_INTERVAL_MS) {
      this.lastSnapshotTs = now;
      this.persist();
    }
    this.emit();
  };

  // Append a point to the drawn/saved route while keeping the in-memory buffer bounded.
  // Once it reaches 2× the target it's decimated back down, so a multi-hour run can't
  // grow the array (and the 4s snapshot it serializes) without limit and OOM the WebView
  // renderer. Distance/elevation/pace are summed per-fix from lastPoint, never from this
  // array, so decimating here does not change any recorded metric.
  private appendRoutePoint(point: RunRoutePoint) {
    if (this.route.length >= MAX_ROUTE_POINTS * 2) {
      this.route = downsample(this.route, MAX_ROUTE_POINTS);
    }
    this.route.push(point);
  }

  // Display-only ticker: refresh elapsed time while tracking. All persisted metrics
  // are derived from GPS timestamps, so a throttled ticker can't corrupt them.
  private tick = () => {
    if (this.status !== "tracking") return;
    this.elapsedSec = this.computeElapsedSec();
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

  private async stopNativeResources() {
    if (this.nativeStopPromise) return this.nativeStopPromise;
    this.nativeStopPromise = (async () => {
      await this.stopWatch();
      if (this.cadenceTracking) {
        this.cadenceSteps += await stopStepCounter();
        this.cadenceTracking = false;
      }
    })();
    try {
      await this.nativeStopPromise;
    } finally {
      this.nativeStopPromise = null;
    }
  }

  private persist(statusOverride?: "tracking" | "paused") {
    void this.saveSnapshot(statusOverride);
  }

  private async saveSnapshot(statusOverride?: "tracking" | "paused") {
    if (this.startTs === 0 || !this.userId) return false;
    const updatedAt = Date.now();
    const persistedStatus = statusOverride ?? (this.status === "paused" ? "paused" : "tracking");
    const pausedAccum =
      persistedStatus === "paused" && this.status === "paused"
        ? this.pausedAccum + Math.max(0, updatedAt - this.pauseStart)
        : this.pausedAccum;
    const snapshot: ActiveRunSnapshot = {
      v: 2,
      userId: this.userId,
      status: persistedStatus,
      startTs: this.startTs,
      pausedAccum,
      distanceM: this.distance,
      elevationM: this.elevation,
      movingSec: this.moving,
      lastPointTs: this.lastPointTs,
      effort: this.effort,
      share: this.share,
      title: this.title,
      description: this.description,
      cadenceSteps: this.cadenceSteps,
      watcherId: this.watcherId ?? undefined,
      route: this.route,
      updatedAt
    };
    return saveActiveRun(snapshot);
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
