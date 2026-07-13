"use client";

import { BatteryCharging, Footprints, MapPin, MapPinOff, Pause, Play, Route as RouteIcon, Square, TimerReset } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { coachRequest } from "@/components/coach/api";
import type { CoachCopy } from "@/components/coach/copy";
import { formatDuration, formatPace } from "@/components/coach/format";
import { RunMap } from "@/components/coach/run-map";
import { RunSummary, SplitsChart } from "@/components/coach/run-summary";
import { useWorkoutGuidance } from "@/components/coach/use-workout-guidance";
import { WorkoutGuidancePanel } from "@/components/coach/workout-guidance-panel";
import { computeSplits, estimateCalories } from "@/lib/coach/run-stats";
import { getQueuedRuns, queueRun, queuedRunCount, removeQueuedRun } from "@/lib/coach/run-queue";
import { buildWorkoutStructure, estimateStructureDistanceKm, flattenStructure, summarizeStructure } from "@/lib/coach/workout-structure";
import { isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimizations } from "@/lib/native/battery";
import { announceComplete, announceStep, countdownTick, primeCues } from "@/lib/native/cues";
import { checkBackgroundLocation, openLocationPermissionSettings, type LocationPermissionState } from "@/lib/native/location-permission";
import { notifyHaptic, tapHaptic } from "@/lib/native/haptics";
import { runEngine, type RunEngineState } from "@/lib/native/run-engine";
import type { CoachLocale, CoachRun } from "@/components/coach/types";
import { Button } from "@/components/ui/button";
import { isNativeRuntime, openLocationSettings } from "@/lib/native/geo";

// A planned workout the runner can execute as a guided session (segment-by-segment coaching).
export type GuidedWorkout = {
  id: string;
  workoutType: string;
  title: string;
  targetDistanceKm: number | null;
  targetDurationMin: number | null;
};

const GUIDED_COPY: Record<CoachLocale, { todaySession: string; startGuided: string; freeRun: string }> = {
  en: { todaySession: "Today's session", startGuided: "Start guided workout", freeRun: "Just free run instead" },
  fr: { todaySession: "Séance du jour", startGuided: "Démarrer la séance guidée", freeRun: "Faire une course libre" },
  ar: { todaySession: "حصة اليوم", startGuided: "ابدأ الحصة الموجَّهة", freeRun: "الجري الحر بدلاً من ذلك" }
};

export function RunRecorder({
  locale,
  copy,
  onSaved,
  weightKg,
  guidedWorkout
}: {
  locale: CoachLocale;
  copy: CoachCopy;
  onSaved: (runId: string, analyze: boolean) => Promise<void>;
  // Runner's weight (from their goal), used for the live calories estimate. Optional —
  // estimateCalories falls back to a default when it's unknown.
  weightKg?: number | null;
  // The next planned workout, if any — offered as a guided (structured) session.
  guidedWorkout?: GuidedWorkout | null;
}) {
  const [native, setNative] = useState(false);
  const [state, setState] = useState<RunEngineState>(() => runEngine.getState());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [batteryOk, setBatteryOk] = useState(true);
  const [bgLocation, setBgLocation] = useState<LocationPermissionState>({ fine: true, background: true });
  // Whether the current recording is running as the guided workout (vs. a free run).
  const [guidedActive, setGuidedActive] = useState(false);
  const guidedCopy = GUIDED_COPY[locale];

  // Derive a runnable structure from the planned workout (no stored structure needed).
  const structure = useMemo(() => (guidedWorkout ? buildWorkoutStructure(guidedWorkout) : null), [guidedWorkout]);
  const guidedSteps = useMemo(() => (structure ? flattenStructure(structure) : []), [structure]);

  const guidance = useWorkoutGuidance(
    guidedSteps,
    { status: state.status, elapsedSec: state.elapsedSec, distanceM: state.distanceM },
    {
      enabled: guidedActive && guidedSteps.length > 0,
      onAdvance: (step) => announceStep(step, locale),
      onComplete: () => announceComplete(locale),
      onCountdown: (secondsLeft) => countdownTick(secondsLeft)
    }
  );

  useEffect(() => {
    setNative(isNativeRuntime());
  }, []);

  // Subscribe to the shared run engine and restore any in-progress run. Crucially we
  // do NOT stop the run when this component unmounts — leaving the Runs tab must keep
  // the recording alive so returning to it shows the run exactly where it was.
  useEffect(() => {
    if (!isNativeRuntime()) return;
    const unsubscribe = runEngine.subscribe(() => setState(runEngine.getState()));
    void runEngine.init();
    return unsubscribe;
  }, []);

  const status = state.status;

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

  // On launch: check the battery-optimization + background-location state.
  useEffect(() => {
    if (!isNativeRuntime()) return;
    void isIgnoringBatteryOptimizations().then(setBatteryOk);
    void checkBackgroundLocation().then(setBgLocation);
  }, []);

  // Re-check permission state when returning from a system dialog; persist on background.
  useEffect(() => {
    if (!native) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void isIgnoringBatteryOptimizations().then(setBatteryOk);
        void checkBackgroundLocation().then(setBgLocation);
      } else {
        runEngine.persistNow();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [native]);

  async function start() {
    setSaveError(null);
    setGuidedActive(false);
    await runEngine.start();
    if (!runEngine.getState().errorCode) tapHaptic("medium");
  }

  // Start recording AND drive the structured workout. Priming cues here (inside the tap gesture)
  // lets audio + speech fire later, mid-run, without a fresh user interaction.
  async function startGuided() {
    setSaveError(null);
    primeCues();
    setGuidedActive(true);
    await runEngine.start();
    if (runEngine.getState().errorCode) setGuidedActive(false);
    else tapHaptic("medium");
  }

  function pause() {
    runEngine.pause();
    tapHaptic("light");
  }

  async function resume() {
    await runEngine.resume();
    if (!runEngine.getState().errorCode) tapHaptic("light");
  }

  async function finish() {
    await runEngine.finish();
    tapHaptic("medium");
  }

  function discard() {
    runEngine.discard();
    setSaveError(null);
    setGuidedActive(false);
  }

  async function enableBackground() {
    await requestIgnoreBatteryOptimizations();
    setBatteryOk(await isIgnoringBatteryOptimizations());
  }

  async function save() {
    const current = runEngine.getState();
    const distanceKm = current.distanceM / 1000;
    if (distanceKm < 0.1 || current.elapsedSec < 60) {
      setSaveError(copy.runTooShort);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSavedOffline(false);
    // Link the run to the planned workout when this was a guided session, so completing it marks
    // the workout done and updates the plan (handled server-side in createRunnerRun).
    const body = {
      ...runEngine.getSavePayload(),
      ...(guidedActive && guidedWorkout ? { workoutId: guidedWorkout.id } : {})
    };
    try {
      const payload = await coachRequest<{ data: { run: CoachRun } }>("/api/coach/runs", {
        method: "POST",
        body: JSON.stringify(body)
      });
      await runEngine.markSaved();
      setGuidedActive(false);
      notifyHaptic("success");
      await onSaved(payload.data.run.id, false);
    } catch (caught) {
      const err = caught as Error & { code?: string };
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      // No error code means the request never reached the server (connectivity) — queue it.
      if (offline || !err.code) {
        queueRun(body, typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `q_${body.startedAt}`);
        await runEngine.markSaved();
        setGuidedActive(false);
        setPendingCount(queuedRunCount());
        setSavedOffline(true);
        notifyHaptic("warning");
      } else {
        setSaveError(err.message || copy.runSaveFailed);
        notifyHaptic("error");
      }
    } finally {
      setSaving(false);
    }
  }

  // New array identity whenever a GPS point is added, so the live map redraws.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trackPoints = useMemo(() => runEngine.getRoute().slice(), [state.pointCount, state.status]);

  // Live per-km splits, recomputed only when a new GPS point lands (not on every tick).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveSplits = useMemo(() => computeSplits(trackPoints), [state.pointCount, state.status]);

  // GPS run recording is phone-only.
  if (!native) return null;

  const distanceKm = state.distanceM / 1000;
  // Average pace over the whole run so far, on MOVING time — this is the pace runners expect
  // (it ignores stops and matches the per-km splits). Falls back to elapsed before the first
  // moving seconds accrue.
  const paceSeconds = state.movingSec > 0 ? state.movingSec : state.elapsedSec;
  const avgPace = distanceKm > 0 ? Math.round(paceSeconds / distanceKm) : null;
  const permissionError = state.errorCode === "NOT_AUTHORIZED";
  const shownError = saveError ?? (state.errorCode ? copy.gpsError : null);
  const gpsValue =
    state.gpsAccuracy == null
      ? copy.gpsAcquiring
      : state.gpsAccuracy <= 12
        ? copy.gpsStrong
        : state.gpsAccuracy <= 25
          ? copy.gpsFair
          : copy.gpsWeak;
  // Signal strength as 0–4 bars (like cellular reception): 0 while acquiring a fix.
  const gpsLevel =
    state.pointCount === 0 || state.gpsAccuracy == null
      ? 0
      : state.gpsAccuracy <= 12
        ? 4
        : state.gpsAccuracy <= 25
          ? 3
          : 2;
  // Live calorie estimate from distance + moving time (falls back to a default weight).
  const calories = estimateCalories(distanceKm, state.movingSec || state.elapsedSec, weightKg);

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

        {/* Background-recording readiness. Shown before starting and while recording so
            the user fixes what makes GPS stop when the screen locks. */}
        {status !== "finished" && !bgLocation.background ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="flex items-center gap-2 text-sm font-black text-red-900">
              <MapPinOff className="size-4 shrink-0" aria-hidden="true" />
              {copy.bgLocationTitle}
            </p>
            <p className="mt-1 text-xs font-semibold text-red-800">{copy.bgLocationText}</p>
            <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => void openLocationPermissionSettings()}>
              {copy.bgLocationCta}
            </Button>
          </div>
        ) : null}

        {status !== "finished" && !batteryOk ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-2 text-sm font-black text-amber-900">
              <BatteryCharging className="size-4 shrink-0" aria-hidden="true" />
              {copy.bgTitle}
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-800">{copy.bgText}</p>
            <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => void enableBackground()}>
              {copy.bgEnable}
            </Button>
          </div>
        ) : null}

        {status === "idle" ? (
          guidedWorkout && structure ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-brand-teal/30 bg-teal-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-brand-teal">{guidedCopy.todaySession}</p>
                <p className="mt-1 text-lg font-black text-gray-950">{guidedWorkout.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gray-600">
                  <RouteIcon className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                  {summarizeStructure(structure, locale)}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-gray-500">≈ {estimateStructureDistanceKm(structure)} km</p>
              </div>
              <Button type="button" size="lg" className="w-full" onClick={() => void startGuided()}>
                <Play className="size-5" aria-hidden="true" /> {guidedCopy.startGuided}
              </Button>
              <button
                type="button"
                onClick={() => void start()}
                className="w-full text-center text-sm font-bold text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
              >
                {guidedCopy.freeRun}
              </button>
            </div>
          ) : (
            <Button type="button" size="lg" className="w-full" onClick={() => void start()}>
              <Play className="size-5" aria-hidden="true" /> {copy.startRun}
            </Button>
          )
        ) : null}

        {status === "tracking" || status === "paused" ? (
          <div className="space-y-5">
            {guidedActive ? <WorkoutGuidancePanel view={guidance} steps={guidedSteps} locale={locale} /> : null}
            {state.pointCount > 0 ? (
              <RunMap points={trackPoints} live className="h-56 w-full overflow-hidden rounded-md border border-gray-200" />
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <LiveStat label={copy.statDistance} value={`${distanceKm.toFixed(2)} km`} big />
              <LiveStat label={copy.statTime} value={formatDuration(state.elapsedSec)} big />
              <LiveStat label={copy.statCurrentPace} value={formatPace(state.currentPace)} big />
              <LiveStat label={copy.statAvgPace} value={formatPace(avgPace)} />
              <LiveStat label={copy.statMovingTime} value={formatDuration(state.movingSec)} />
              <LiveStat label={copy.statElevation} value={`${Math.round(state.elevationM)} m`} />
              <GpsSignalStat label={copy.statGps} status={state.pointCount > 0 ? gpsValue : copy.gpsAcquiring} level={gpsLevel} />
              <LiveStat label={copy.statCalories} value={calories != null ? `${calories} kcal` : "-"} />
            </div>
            {liveSplits.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{copy.splitsLabel}</h3>
                <SplitsChart splits={liveSplits} copy={copy} />
              </div>
            ) : null}
            <div className="flex gap-3">
              {status === "tracking" ? (
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={pause}>
                  <Pause className="size-5" aria-hidden="true" /> {copy.pause}
                </Button>
              ) : (
                <Button type="button" size="lg" className="flex-1" onClick={() => void resume()}>
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
            {state.pointCount > 1 ? (
              <RunMap points={trackPoints} className="h-56 w-full overflow-hidden rounded-md border border-gray-200" />
            ) : null}
            <RunSummary
              points={trackPoints}
              distanceKm={distanceKm}
              durationSeconds={state.elapsedSec}
              movingSeconds={state.movingSec}
              avgPaceSecondsPerKm={avgPace}
              elevationGainM={Math.round(state.elevationM)}
              avgCadence={state.avgCadence}
              copy={copy}
            />
            <label className="grid gap-2 text-sm font-bold text-gray-800">
              <span>{copy.runTitle}</span>
              <input
                type="text"
                value={state.title}
                onChange={(event) => runEngine.setTitle(event.target.value)}
                maxLength={120}
                placeholder={copy.runTitlePlaceholder}
                className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-gray-800">
              <span>{copy.description}</span>
              <textarea
                value={state.description}
                onChange={(event) => runEngine.setDescription(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={copy.descriptionPlaceholder}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-gray-800">
              <span className="flex items-center justify-between">
                <span>{copy.effort}</span>
                <strong className="text-brand-teal">{state.effort}/10</strong>
              </span>
              <input type="range" min={1} max={10} step={1} value={state.effort} onChange={(event) => runEngine.setEffort(Number(event.target.value))} className="w-full accent-brand-teal" />
            </label>
            <label className="flex items-start gap-3 rounded-md border border-gray-200 p-3 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={state.share} onChange={(event) => runEngine.setShare(event.target.checked)} className="mt-0.5 size-4 accent-brand-teal" />
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

        {shownError ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {shownError}
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

// GPS reception shown as ascending signal bars (like a phone's cellular indicator).
// level 0 = still acquiring a fix (bars pulse), 2 = weak, 3 = fair, 4 = strong.
function GpsSignalStat({ label, status, level }: { label: string; status: string; level: number }) {
  const tone = level >= 4 ? "bg-green-500" : level === 3 ? "bg-amber-500" : level > 0 ? "bg-red-500" : "bg-gray-300";
  const heights = [6, 10, 14, 18];
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-1.5 flex h-[18px] items-end justify-center gap-1" aria-hidden="true">
        {heights.map((height, index) => (
          <span
            key={height}
            className={`w-1.5 rounded-sm ${index < level ? tone : "bg-gray-200"} ${level === 0 ? "animate-pulse" : ""}`}
            style={{ height }}
          />
        ))}
      </div>
      <p className="mt-1 text-xs font-black text-gray-950">{status}</p>
    </div>
  );
}
