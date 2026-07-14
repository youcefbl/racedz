"use client";

import { Activity, AlertTriangle, ChevronDown, Download, Flame, Footprints, Globe, Images, Lock, Mountain, Plus, Route, Sparkles, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState, useTransition } from "react";
import { coachRequest } from "@/components/coach/api";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDateTime, formatDuration, formatPace } from "@/components/coach/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RunRecorder, type GuidedWorkout } from "@/components/coach/run-recorder";
import { RunPhotoUploader } from "@/components/coach/run-photos";
import { RunRouteMap } from "@/components/coach/run-route-map";
import { RunMap } from "@/components/coach/run-map";
import { RunSummary } from "@/components/coach/run-summary";
import type { CoachLocale, CoachPlan, CoachRun } from "@/components/coach/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CoachRunsPanel({
  runs,
  plan,
  locale,
  copy,
  pendingAction,
  onSaved,
  onAnalyze,
  analyzedRuns,
  onViewAnalysis,
  weightKg,
  guidedWorkout
}: {
  runs: CoachRun[];
  plan: CoachPlan | null;
  locale: CoachLocale;
  copy: CoachCopy;
  pendingAction: string | null;
  onSaved: (runId: string, analyze: boolean) => Promise<void>;
  onAnalyze: (runId: string) => Promise<void>;
  /** runId → id of the existing POST_RUN analysis, when the run has already been analyzed. */
  analyzedRuns?: Record<string, string>;
  onViewAnalysis?: (interactionId: string) => void;
  /** Runner's weight, forwarded to the recorder for a live calorie estimate. */
  weightKg?: number | null;
  /** Next planned workout, offered as a guided (structured) session in the recorder. */
  guidedWorkout?: GuidedWorkout | null;
}) {
  const [showForm, setShowForm] = useState(runs.length === 0);
  const [effort, setEffort] = useState(5);
  const [fatigue, setFatigue] = useState(3);
  const [pain, setPain] = useState(0);
  const [distance, setDistance] = useState(5);
  const [duration, setDuration] = useState(35);
  const [share, setShare] = useState(false);
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  // Local, per-run photo overrides so a photo added/removed on a history row shows instantly,
  // before the list refetches. Falls back to the run's server-side photos.
  const [photoOverrides, setPhotoOverrides] = useState<Record<string, string[]>>({});
  // Ref mirror so the memoized row's stable `updatePhotos` can read the latest overrides for
  // rollback without a `photoOverrides` dependency that would recreate the callback (and
  // re-render every row) on each photo change.
  const photoOverridesRef = useRef(photoOverrides);
  photoOverridesRef.current = photoOverrides;
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Open the most recent GPS run by default so its map + per-km splits show without a
  // tap; older runs stay collapsed to avoid mounting many maps at once.
  const [expandedRun, setExpandedRun] = useState<string | null>(
    () => runs.find((run) => run.route && run.route.length > 1)?.id ?? null
  );
  const [saving, startSaving] = useTransition();
  const pace = useMemo(() => (distance > 0 && duration > 0 ? Math.round((duration * 60) / distance) : null), [distance, duration]);
  const plannedWorkouts = plan?.workouts.filter((workout) => workout.status !== "COMPLETED") ?? [];

  function submit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startSaving(async () => {
      try {
        const payload = await coachRequest<{ data: { run: CoachRun } }>("/api/coach/runs", {
          method: "POST",
          body: JSON.stringify({
            workoutId: optionalString(formData, "workoutId"),
            startedAt: new Date(String(formData.get("startedAt"))).toISOString(),
            distanceKm: distance,
            durationSeconds: Math.round(duration * 60),
            elevationGainM: optionalNumber(formData, "elevationGainM"),
            averageHeartRate: optionalNumber(formData, "averageHeartRate"),
            perceivedEffort: effort,
            fatigueLevel: fatigue,
            painLevel: pain,
            isPublic: share,
            title: optionalString(formData, "title"),
            symptoms: optionalString(formData, "symptoms"),
            notes: optionalString(formData, "notes"),
            photos: formPhotos
          })
        });
        const analyze = formData.get("analyzeNow") === "on";
        setSuccess(copy.runSaved);
        setFormPhotos([]);
        setShowForm(false);
        try {
          await onSaved(payload.data.run.id, analyze);
        } catch (caught) {
          setError(copy.runSavedFeedbackFailed.replace("{error}", caught instanceof Error ? caught.message : "—"));
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : copy.runSaveFailed);
      }
    });
  }

  // Row handlers are memoized (stable identity) so the memoized RunRow's props don't change on
  // unrelated parent re-renders (e.g. dragging the add-run sliders) — keeping all rows skipped.
  const toggleVisibility = useCallback(
    (runId: string, next: boolean) => {
      setError(null);
      startSaving(async () => {
        try {
          await coachRequest(`/api/coach/runs/${runId}`, { method: "PATCH", body: JSON.stringify({ isPublic: next }) });
          await onSaved("", false);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : copy.runUpdateFailed);
        }
      });
    },
    [onSaved, copy]
  );

  const handleExpand = useCallback((runId: string) => {
    setExpandedRun((current) => (current === runId ? null : runId));
  }, []);

  const requestDelete = useCallback((runId: string) => setPendingDelete(runId), []);

  function deleteRun(runId: string) {
    setError(null);
    startSaving(async () => {
      try {
        await coachRequest(`/api/coach/runs/${runId}`, { method: "DELETE" });
        setExpandedRun((current) => (current === runId ? null : current));
        await onSaved("", false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : copy.runUpdateFailed);
      }
    });
  }

  // Persist a run's photo list after an add/remove on its history row. The override is set
  // first (instant feedback); on failure it's rolled back to the run's server value.
  const updatePhotos = useCallback(
    async (run: CoachRun, next: string[]) => {
      const previous = photoOverridesRef.current[run.id] ?? run.photos ?? [];
      setError(null);
      setPhotoOverrides((prev) => ({ ...prev, [run.id]: next }));
      try {
        await coachRequest(`/api/coach/runs/${run.id}`, { method: "PATCH", body: JSON.stringify({ photos: next }) });
      } catch (caught) {
        setPhotoOverrides((prev) => ({ ...prev, [run.id]: previous }));
        setError(caught instanceof Error ? caught.message : copy.runUpdateFailed);
      }
    },
    [copy]
  );

  return (
    <div className="space-y-6">
      {/* GPS run recorder — the record hero; renders only inside the phone app */}
      <RunRecorder locale={locale} copy={copy} onSaved={onSaved} weightKg={weightKg} guidedWorkout={guidedWorkout} />

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-gray-950">{copy.runHistory}</h2>
          <button
            type="button"
            aria-expanded={showForm}
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-brand-teal shadow-sm transition hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            <Plus className={cn("size-4 transition-transform", showForm && "rotate-45")} aria-hidden="true" />
            {copy.logRun}
          </button>
        </div>

        {showForm ? (
          <form action={submit} className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <Field label={copy.runTitle}>
                <input name="title" maxLength={120} placeholder={copy.runTitlePlaceholder} className={inputClass} />
              </Field>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.startedAt}>
                  <input name="startedAt" type="datetime-local" required defaultValue={localDateTime()} className={inputClass} />
                </Field>
                <Field label={copy.distance}>
                  <input value={distance} onChange={(event) => setDistance(Number(event.target.value))} type="number" min="0.1" max="500" step="0.1" required className={inputClass} />
                </Field>
                <Field label={copy.durationMinutes}>
                  <input value={duration} onChange={(event) => setDuration(Number(event.target.value))} type="number" min="1" max="2880" step="0.1" required className={inputClass} />
                </Field>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs font-bold uppercase text-gray-500">{copy.avgPace}</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-gray-950">{formatPace(pace)}</p>
                </div>
                <Field label={copy.elevation}>
                  <input name="elevationGainM" type="number" min="0" max="20000" className={inputClass} />
                </Field>
                <Field label={copy.heartRate}>
                  <input name="averageHeartRate" type="number" min="30" max="250" className={inputClass} />
                </Field>
                {plannedWorkouts.length > 0 ? (
                  <Field label={copy.plan} className="sm:col-span-2">
                    <select name="workoutId" className={inputClass}>
                      <option value="">-</option>
                      {plannedWorkouts.map((workout) => (
                        <option key={workout.id ?? workout.scheduledFor} value={workout.id}>{workout.title} - {workout.targetDistanceKm ?? "-"} km</option>
                      ))}
                    </select>
                  </Field>
                ) : null}
              </div>

              <div className="space-y-4">
                <RangeField label={copy.effort} value={effort} onChange={setEffort} min={1} />
                <RangeField label={copy.runFatigue} value={fatigue} onChange={setFatigue} />
                <RangeField label={copy.pain} value={pain} onChange={setPain} danger={pain >= 7} />
                <Field label={copy.symptoms}>
                  <input name="symptoms" maxLength={500} className={inputClass} />
                </Field>
                <Field label={copy.description}>
                  <textarea name="notes" maxLength={2000} rows={3} placeholder={copy.descriptionPlaceholder} className={inputClass} />
                </Field>
              </div>
            </div>

            <div className="mt-5 border-t border-gray-200 pt-5">
              <p className="mb-1 text-sm font-bold text-gray-800">{copy.photos}</p>
              <p className="mb-3 text-xs font-medium text-gray-500">{copy.photoHelp}</p>
              <RunPhotoUploader value={formPhotos} onChange={setFormPhotos} copy={copy} />
            </div>

            {pain >= 7 ? (
              <div className="mt-5 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {copy.highPainWarning}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-4 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-2">
                <label className="flex items-start gap-3 text-sm font-semibold text-gray-700">
                  <input name="analyzeNow" type="checkbox" defaultChecked className="mt-0.5 size-4 accent-brand-teal" />
                  {copy.analyzeNow}
                </label>
                <label className="flex items-start gap-3 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={share} onChange={(event) => setShare(event.target.checked)} className="mt-0.5 size-4 accent-brand-teal" />
                  {copy.shareRun}
                </label>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? copy.savingRun : copy.saveRun}
              </Button>
            </div>
          </form>
        ) : null}

        {success ? <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{success}</p> : null}
        {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

        {runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-50 text-brand-orange">
              <Route className="size-6" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-gray-600">{copy.noRuns}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                isOpen={expandedRun === run.id}
                photoOverride={photoOverrides[run.id]}
                analysisId={analyzedRuns?.[run.id]}
                saving={saving}
                pendingAction={pendingAction}
                locale={locale}
                copy={copy}
                onExpand={handleExpand}
                onAnalyze={onAnalyze}
                onViewAnalysis={onViewAnalysis}
                onToggleVisibility={toggleVisibility}
                onRequestDelete={requestDelete}
                onUpdatePhotos={updatePhotos}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={copy.deleteRunTitle}
        description={copy.deleteRunText}
        confirmLabel={copy.deleteRun}
        cancelLabel={copy.cancel}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const runId = pendingDelete;
          setPendingDelete(null);
          if (runId) deleteRun(runId);
        }}
      />
    </div>
  );
}

// One run in the history list, memoized so it only re-renders when its own props change.
// Handlers arrive pre-memoized from the parent, so unrelated parent re-renders (e.g. dragging
// the add-run sliders, or expanding a *different* run) skip every other row — including its
// SVG route thumbnail — instead of re-rendering all ~50 at once.
const RunRow = memo(function RunRow({
  run,
  isOpen,
  photoOverride,
  analysisId,
  saving,
  pendingAction,
  locale,
  copy,
  onExpand,
  onAnalyze,
  onViewAnalysis,
  onToggleVisibility,
  onRequestDelete,
  onUpdatePhotos
}: {
  run: CoachRun;
  isOpen: boolean;
  photoOverride: string[] | undefined;
  analysisId: string | undefined;
  saving: boolean;
  pendingAction: string | null;
  locale: CoachLocale;
  copy: CoachCopy;
  onExpand: (runId: string) => void;
  onAnalyze: (runId: string) => void;
  onViewAnalysis?: (interactionId: string) => void;
  onToggleVisibility: (runId: string, next: boolean) => void;
  onRequestDelete: (runId: string) => void;
  onUpdatePhotos: (run: CoachRun, next: string[]) => void;
}) {
  const hasRoute = Boolean(run.route && run.route.length > 1);
  const photos = photoOverride ?? run.photos ?? [];
  return (
    <article className={cn("overflow-hidden rounded-xl border bg-white shadow-sm transition-colors", isOpen ? "border-brand-teal" : "border-gray-200")}>
      <div className="p-4">
        {/* Header: route thumbnail as the run's visual anchor + title/date */}
        <div className="flex items-start gap-3">
          {hasRoute ? (
            <RunRouteMap points={run.route} className="size-14 shrink-0 rounded-lg" />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-brand-orange" aria-hidden="true">
              <Route className="size-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-black text-gray-950">{run.title || formatCoachDateTime(run.startedAt, locale)}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">
              {run.title ? formatCoachDateTime(run.startedAt, locale) : run.route ? copy.gpsRunLabel : copy.manualRunLabel}
            </p>
          </div>
          {photos.length > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-xs font-bold text-gray-500" title={copy.photos}>
              <Images className="size-3.5" aria-hidden="true" />
              {photos.length}
            </span>
          ) : null}
        </div>

        {/* Hero stats: the three numbers that matter, distance accented */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-gray-200 rounded-lg bg-gray-50 py-2.5">
          <RunStat label={copy.statDistance} value={`${run.distanceKm} km`} accent />
          <RunStat label={copy.statPace} value={formatPace(run.averagePaceSecondsPerKm)} />
          <RunStat label={copy.statTime} value={formatDuration(run.durationSeconds)} />
        </div>

        {/* Secondary facts, only when there's data */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-gray-500">
          {run.calories != null ? <RunChip icon={Flame} label={`${run.calories} kcal`} /> : null}
          {run.elevationGainM != null && run.elevationGainM > 0 ? <RunChip icon={Mountain} label={`${run.elevationGainM} m`} /> : null}
          {run.avgCadence != null && run.avgCadence > 0 ? <RunChip icon={Footprints} label={`${run.avgCadence} spm`} /> : null}
          <RunChip icon={Activity} label={`${copy.effort} ${run.perceivedEffort}/10`} />
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onExpand(run.id)}
            aria-expanded={isOpen}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
              isOpen && "border-brand-teal bg-teal-50 text-brand-teal",
              !isOpen && "border-gray-200 text-gray-600 hover:border-brand-teal hover:text-brand-teal"
            )}
          >
            <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
            {copy.details}
          </button>
          {analysisId && onViewAnalysis ? (
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onViewAnalysis(analysisId)}>
              <Sparkles className="size-4" aria-hidden="true" /> {copy.viewAnalysis}
            </Button>
          ) : (
            <Button type="button" size="sm" className="min-h-11" disabled={pendingAction === "POST_RUN"} onClick={() => void onAnalyze(run.id)}>
              <Sparkles className="size-4" aria-hidden="true" /> {copy.analyzeRun}
            </Button>
          )}
        </div>
      </div>

      {isOpen ? (
        <div className="space-y-4 border-t border-gray-200 bg-gray-50 p-4">
          {run.notes ? (
            <p className="whitespace-pre-line rounded-lg bg-white px-3 py-2.5 text-sm leading-6 text-gray-700 shadow-sm">{run.notes}</p>
          ) : null}
          {hasRoute && run.route ? (
            <>
              <RunMap points={run.route} className="h-56 w-full overflow-hidden rounded-lg border border-gray-200" />
              <RunSummary
                points={run.route}
                distanceKm={run.distanceKm}
                durationSeconds={run.durationSeconds}
                movingSeconds={run.movingTimeSeconds ?? run.durationSeconds}
                avgPaceSecondsPerKm={run.averagePaceSecondsPerKm}
                elevationGainM={run.elevationGainM}
                avgCadence={run.avgCadence}
                calories={run.calories}
                copy={copy}
              />
            </>
          ) : null}
          <div>
            <p className="mb-2 text-sm font-bold text-gray-800">{copy.photos}</p>
            <RunPhotoUploader value={photos} onChange={(next) => onUpdatePhotos(run, next)} copy={copy} disabled={saving} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => onToggleVisibility(run.id, !run.isPublic)}
              disabled={saving}
              aria-pressed={run.isPublic}
              title={copy.visibility}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-50",
                run.isPublic ? "border-brand-teal text-brand-teal" : "border-gray-200 text-gray-500 hover:border-brand-teal"
              )}
            >
              {run.isPublic ? <Globe className="size-3.5" aria-hidden="true" /> : <Lock className="size-3.5" aria-hidden="true" />}
              {run.isPublic ? copy.publicLabel : copy.privateLabel}
            </button>
            {run.route && run.route.length > 1 ? (
              <a
                href={`/api/coach/runs/${run.id}/gpx`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-500 transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              >
                <Download className="size-3.5" aria-hidden="true" />
                GPX
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => onRequestDelete(run.id)}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {copy.deleteRun}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
});

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid min-w-0 gap-2 text-sm font-bold text-gray-800 ${className}`}><span>{label}</span>{children}</label>;
}

function RangeField({ label, value, onChange, min = 0, danger = false }: { label: string; value: number; onChange: (value: number) => void; min?: number; danger?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-gray-800">
      <span className="flex items-center justify-between"><span>{label}</span><strong className={danger ? "text-red-700" : "text-brand-teal"}>{value}/10</strong></span>
      <input type="range" min={min} max="10" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-brand-teal" />
    </label>
  );
}

// One of the three headline numbers on a run card. Distance is accented as the primary stat.
function RunStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cn("mt-0.5 text-lg font-black tabular-nums", accent ? "text-brand-teal" : "text-gray-950")}>{value}</p>
    </div>
  );
}

function RunChip({ icon: Icon, label }: { icon: typeof Route; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0 text-brand-orange" aria-hidden="true" />
      {label}
    </span>
  );
}

const inputClass = "min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20";

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? Number(value) : null;
}

function localDateTime() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}
