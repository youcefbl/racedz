"use client";

import { Footprints, MapPin, Pause, Play, Square, TimerReset } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { coachRequest } from "@/components/coach/api";
import type { CoachCopy } from "@/components/coach/copy";
import { formatDuration, formatPace } from "@/components/coach/format";
import { RunRouteMap } from "@/components/coach/run-route-map";
import { getQueuedRuns, queueRun, queuedRunCount, removeQueuedRun } from "@/lib/coach/run-queue";
import { notifyHaptic, tapHaptic } from "@/lib/native/haptics";
import type { CoachLocale, CoachRun, RunRoutePoint } from "@/components/coach/types";
import { Button } from "@/components/ui/button";
import {
  haversineMeters,
  isNativeRuntime,
  openLocationSettings,
  startRunWatch,
  stopRunWatch,
  type LivePoint
} from "@/lib/native/geo";

type RecorderStatus = "idle" | "tracking" | "paused" | "finished";

const MAX_ROUTE_POINTS = 1500;

export function RunRecorder({
  locale,
  copy,
  onSaved
}: {
  locale: CoachLocale;
  copy: CoachCopy;
  onSaved: (runId: string, analyze: boolean) => Promise<void>;
}) {
  const [native, setNative] = useState(false);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [movingSec, setMovingSec] = useState(0);
  const [elevationM, setElevationM] = useState(0);
  const [currentPace, setCurrentPace] = useState<number | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const [effort, setEffort] = useState(5);
  const [share, setShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const watcherId = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const route = useRef<RunRoutePoint[]>([]);
  const lastPoint = useRef<LivePoint | null>(null);
  const distanceRef = useRef(0);
  const elevationRef = useRef(0);
  const movingRef = useRef(0);
  const lastMoveTs = useRef(0);
  const startTs = useRef(0);
  const pausedAccum = useRef(0);
  const pauseStart = useRef(0);
  const statusRef = useRef<RecorderStatus>("idle");

  useEffect(() => {
    setNative(isNativeRuntime());
  }, []);

  const stopTimer = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const cleanup = useCallback(async () => {
    stopTimer();
    if (watcherId.current) {
      await stopRunWatch(watcherId.current);
      watcherId.current = null;
    }
  }, [stopTimer]);

  // Stop tracking if the component unmounts.
  useEffect(() => {
    return () => {
      stopTimer();
      if (watcherId.current) void stopRunWatch(watcherId.current);
    };
  }, [stopTimer]);

  // Upload any runs that were saved offline, and retry when connectivity returns.
  const flushQueue = useCallback(async () => {
    const items = getQueuedRuns();
    if (items.length === 0) {
      setPendingCount(0);
      return;
    }
    let synced = false;
    for (const item of items) {
      try {
        await coachRequest("/api/coach/runs", { method: "POST", body: JSON.stringify(item.payload) });
        removeQueuedRun(item.id);
        synced = true;
      } catch (caught) {
        const err = caught as Error & { code?: string };
        if (err.code) {
          // Server rejected it (not a connectivity issue) — drop so it never gets stuck.
          removeQueuedRun(item.id);
          synced = true;
        } else {
          break; // offline — stop and retry later
        }
      }
    }
    setPendingCount(queuedRunCount());
    if (synced) await onSaved("", false).catch(() => {});
  }, [onSaved]);

  useEffect(() => {
    setPendingCount(queuedRunCount());
    void flushQueue();
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushQueue]);

  const setStatusBoth = (next: RecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const onPoint = useCallback((point: LivePoint) => {
    if (statusRef.current !== "tracking") return;
    if (point.accuracy != null && point.accuracy > 40) return; // too noisy

    const prev = lastPoint.current;
    if (prev) {
      const d = haversineMeters(prev, point);
      if (d >= 1 && d <= 60) {
        distanceRef.current += d;
        setDistanceM(distanceRef.current);
        lastMoveTs.current = Date.now();
        if (prev.ele != null && point.ele != null) {
          const delta = point.ele - prev.ele;
          if (delta > 1) {
            elevationRef.current += delta;
            setElevationM(elevationRef.current);
          }
        }
        if (route.current.length < 100000) {
          route.current.push({ lat: point.lat, lng: point.lng, ele: point.ele, t: point.t });
          setPointCount(route.current.length);
        }
      }
    } else {
      lastPoint.current = point;
      route.current.push({ lat: point.lat, lng: point.lng, ele: point.ele, t: point.t });
      setPointCount(route.current.length);
    }
    lastPoint.current = point;

    setCurrentPace(point.speed != null && point.speed > 0.4 ? Math.round(1000 / point.speed) : null);
  }, []);

  const tick = useCallback(() => {
    if (statusRef.current !== "tracking") return;
    const now = Date.now();
    setElapsedSec(Math.floor((now - startTs.current - pausedAccum.current) / 1000));
    if (now - lastMoveTs.current < 6000) {
      movingRef.current += 1;
      setMovingSec(movingRef.current);
    }
  }, []);

  async function start() {
    setError(null);
    setPermissionError(false);
    distanceRef.current = 0;
    elevationRef.current = 0;
    movingRef.current = 0;
    route.current = [];
    lastPoint.current = null;
    startTs.current = Date.now();
    pausedAccum.current = 0;
    lastMoveTs.current = Date.now();
    setDistanceM(0);
    setElapsedSec(0);
    setMovingSec(0);
    setElevationM(0);
    setCurrentPace(null);
    setPointCount(0);
    try {
      const id = await startRunWatch(onPoint, (err) => {
        setPermissionError(err.code === "NOT_AUTHORIZED");
        setError(copy.gpsError);
      });
      watcherId.current = id;
      setStatusBoth("tracking");
      stopTimer();
      timer.current = setInterval(tick, 1000);
      tapHaptic("medium");
    } catch {
      setError(copy.gpsError);
    }
  }

  function pause() {
    pauseStart.current = Date.now();
    setStatusBoth("paused");
    tapHaptic("light");
  }

  function resume() {
    pausedAccum.current += Date.now() - pauseStart.current;
    lastMoveTs.current = Date.now();
    setStatusBoth("tracking");
    tapHaptic("light");
  }

  async function finish() {
    await cleanup();
    setStatusBoth("finished");
    tapHaptic("medium");
  }

  function discard() {
    void cleanup();
    statusRef.current = "idle";
    setStatus("idle");
    setError(null);
  }

  async function save() {
    const distanceKm = distanceRef.current / 1000;
    const durationSeconds = elapsedSec;
    if (distanceKm < 0.1 || durationSeconds < 60) {
      setError(copy.runTooShort);
      return;
    }
    setSaving(true);
    setError(null);
    setSavedOffline(false);
    const body = {
      startedAt: new Date(startTs.current).toISOString(),
      distanceKm: Number(distanceKm.toFixed(3)),
      durationSeconds,
      movingTimeSeconds: movingRef.current,
      elevationGainM: Math.round(elevationRef.current),
      perceivedEffort: effort,
      source: "GPS" as const,
      isPublic: share,
      route: downsample(route.current, MAX_ROUTE_POINTS)
    };
    try {
      const payload = await coachRequest<{ data: { run: CoachRun } }>("/api/coach/runs", {
        method: "POST",
        body: JSON.stringify(body)
      });
      statusRef.current = "idle";
      setStatus("idle");
      notifyHaptic("success");
      await onSaved(payload.data.run.id, false);
    } catch (caught) {
      const err = caught as Error & { code?: string };
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      // No error code means the request never reached the server (connectivity) — queue it.
      if (offline || !err.code) {
        queueRun(body, typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `q_${startTs.current}`);
        setPendingCount(queuedRunCount());
        setSavedOffline(true);
        statusRef.current = "idle";
        setStatus("idle");
        notifyHaptic("warning");
      } else {
        setError(err.message || copy.runSaveFailed);
        notifyHaptic("error");
      }
    } finally {
      setSaving(false);
    }
  }

  // GPS run recording is phone-only.
  if (!native) return null;

  const distanceKm = distanceM / 1000;

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
        <MapPin className="size-5 text-brand-orange" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-black text-gray-950">{copy.recordRun}</h2>
          <p className="text-xs font-semibold text-gray-500">{copy.recordHint}</p>
        </div>
      </div>

      <div className="p-5">
        {pendingCount > 0 ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
            <span>{copy.pendingUploads.replace("{n}", String(pendingCount))}</span>
            <button type="button" onClick={() => void flushQueue()} className="underline">
              {copy.retryUpload}
            </button>
          </div>
        ) : null}
        {savedOffline ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            {copy.savedOffline}
          </div>
        ) : null}

        {status === "idle" ? (
          <Button type="button" size="lg" className="w-full" onClick={() => void start()}>
            <Play className="size-5" aria-hidden="true" /> {copy.startRun}
          </Button>
        ) : null}

        {status === "tracking" || status === "paused" ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <LiveStat label={copy.statDistance} value={`${distanceKm.toFixed(2)} km`} big />
              <LiveStat label={copy.statTime} value={formatDuration(elapsedSec)} big />
              <LiveStat label={copy.statPace} value={formatPace(currentPace)} big />
              <LiveStat label={copy.statMovingTime} value={formatDuration(movingSec)} />
              <LiveStat label={copy.statElevation} value={`${Math.round(elevationM)} m`} />
              <LiveStat label="GPS" value={pointCount > 0 ? `${pointCount}` : copy.gpsAcquiring} />
            </div>
            <div className="flex gap-3">
              {status === "tracking" ? (
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={pause}>
                  <Pause className="size-5" aria-hidden="true" /> {copy.pause}
                </Button>
              ) : (
                <Button type="button" size="lg" className="flex-1" onClick={resume}>
                  <Play className="size-5" aria-hidden="true" /> {copy.resume}
                </Button>
              )}
              <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => void finish()}>
                <Square className="size-5" aria-hidden="true" /> {copy.finishRun}
              </Button>
            </div>
          </div>
        ) : null}

        {status === "finished" ? (
          <div className="space-y-5">
            <RunRouteMap points={route.current} className="mx-auto block aspect-square w-44" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <LiveStat label={copy.statDistance} value={`${distanceKm.toFixed(2)} km`} big />
              <LiveStat label={copy.statTime} value={formatDuration(elapsedSec)} big />
              <LiveStat label={copy.statPace} value={formatPace(distanceKm > 0 ? Math.round(elapsedSec / distanceKm) : null)} big />
              <LiveStat label={copy.statMovingTime} value={formatDuration(movingSec)} />
              <LiveStat label={copy.statElevation} value={`${Math.round(elevationM)} m`} />
            </div>
            <label className="grid gap-2 text-sm font-bold text-gray-800">
              <span className="flex items-center justify-between">
                <span>{copy.effort}</span>
                <strong className="text-brand-teal">{effort}/10</strong>
              </span>
              <input type="range" min={1} max={10} step={1} value={effort} onChange={(event) => setEffort(Number(event.target.value))} className="w-full accent-brand-teal" />
            </label>
            <label className="flex items-start gap-3 rounded-md border border-gray-200 p-3 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={share} onChange={(event) => setShare(event.target.checked)} className="mt-0.5 size-4 accent-brand-teal" />
              <span>
                {copy.shareRun}
                <span className="mt-0.5 block text-xs font-medium text-gray-500">{copy.shareHint}</span>
              </span>
            </label>
            <div className="flex gap-3">
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={discard}>
                <TimerReset className="size-5" aria-hidden="true" /> {copy.discard}
              </Button>
              <Button type="button" size="lg" className="flex-1" disabled={saving} onClick={() => void save()}>
                <Footprints className="size-5" aria-hidden="true" /> {saving ? copy.savingRun : copy.saveRun}
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
            {permissionError ? (
              <button type="button" onClick={() => void openLocationSettings()} className="mt-2 block underline">
                {copy.openSettings}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LiveStat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 font-black text-gray-950 ${big ? "text-2xl" : "text-base"}`}>{value}</p>
    </div>
  );
}

function downsample(points: RunRoutePoint[], max: number): RunRoutePoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: RunRoutePoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}
