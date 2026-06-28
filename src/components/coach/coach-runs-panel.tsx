"use client";

import { Activity, AlertTriangle, CalendarDays, Flame, Gauge, Globe, HeartPulse, Lock, Plus, Route, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { coachRequest } from "@/components/coach/api";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDateTime, formatDuration, formatPace } from "@/components/coach/format";
import { RunRecorder } from "@/components/coach/run-recorder";
import { RunRouteMap } from "@/components/coach/run-route-map";
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
  onAnalyze
}: {
  runs: CoachRun[];
  plan: CoachPlan | null;
  locale: CoachLocale;
  copy: CoachCopy;
  pendingAction: string | null;
  onSaved: (runId: string, analyze: boolean) => Promise<void>;
  onAnalyze: (runId: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(runs.length === 0);
  const [effort, setEffort] = useState(5);
  const [fatigue, setFatigue] = useState(3);
  const [pain, setPain] = useState(0);
  const [distance, setDistance] = useState(5);
  const [duration, setDuration] = useState(35);
  const [share, setShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
            symptoms: optionalString(formData, "symptoms"),
            notes: optionalString(formData, "notes")
          })
        });
        const analyze = formData.get("analyzeNow") === "on";
        setSuccess(copy.runSaved);
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

  function toggleVisibility(runId: string, next: boolean) {
    setError(null);
    startSaving(async () => {
      try {
        await coachRequest(`/api/coach/runs/${runId}`, { method: "PATCH", body: JSON.stringify({ isPublic: next }) });
        await onSaved("", false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : copy.runUpdateFailed);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* GPS run recorder — renders only inside the phone app */}
      <RunRecorder locale={locale} copy={copy} onSaved={onSaved} />

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-brand-teal" aria-hidden="true" />
            <h2 className="text-xl font-black text-gray-950">{copy.logRun}</h2>
          </div>
          <button
            type="button"
            aria-label={copy.logRun}
            aria-expanded={showForm}
            onClick={() => setShowForm((value) => !value)}
            className="flex size-10 items-center justify-center rounded-md border border-gray-200 text-brand-teal transition hover:border-brand-teal hover:bg-teal-50"
          >
            <Plus className={`size-5 transition ${showForm ? "rotate-45" : ""}`} aria-hidden="true" />
          </button>
        </div>

        {showForm ? (
          <form action={submit} className="p-5">
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
                  <p className="mt-1 text-lg font-black text-gray-950">{formatPace(pace)}</p>
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
                <Field label={copy.notes}>
                  <textarea name="notes" maxLength={2000} rows={3} className={inputClass} />
                </Field>
              </div>
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
        {success ? <p className="border-t border-gray-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700">{success}</p> : null}
        {error ? <p role="alert" className="border-t border-gray-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
          <Route className="size-5 text-brand-orange" aria-hidden="true" />
          <h2 className="text-xl font-black text-gray-950">{copy.runHistory}</h2>
        </div>
        {runs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-600">{copy.noRuns}</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {runs.map((run) => (
              <article key={run.id} className="grid gap-4 px-5 py-4 md:grid-cols-[auto_minmax(150px,.8fr)_repeat(5,minmax(64px,.4fr))_auto] md:items-center">
                {run.route && run.route.length > 1 ? (
                  <RunRouteMap points={run.route} className="size-12 shrink-0 rounded-md" />
                ) : (
                  <span className="hidden size-12 md:block" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-black text-gray-950">{formatCoachDateTime(run.startedAt, locale)}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">{run.notes || (run.route ? copy.gpsRunLabel : copy.manualRunLabel)}</p>
                </div>
                <RunFact icon={Route} label={`${run.distanceKm} km`} />
                <RunFact icon={Gauge} label={formatPace(run.averagePaceSecondsPerKm)} />
                <RunFact icon={CalendarDays} label={formatDuration(run.durationSeconds)} />
                <RunFact icon={Flame} label={run.calories != null ? `${run.calories}` : "-"} />
                <RunFact icon={HeartPulse} label={`${run.perceivedEffort}/10`} />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleVisibility(run.id, !run.isPublic)}
                    disabled={saving}
                    aria-pressed={run.isPublic}
                    title={run.isPublic ? copy.publicLabel : copy.privateLabel}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-bold transition disabled:opacity-50",
                      run.isPublic
                        ? "border-brand-teal bg-teal-50 text-brand-teal"
                        : "border-gray-200 text-gray-500 hover:border-brand-teal"
                    )}
                  >
                    {run.isPublic ? <Globe className="size-3.5" aria-hidden="true" /> : <Lock className="size-3.5" aria-hidden="true" />}
                    {run.isPublic ? copy.publicLabel : copy.privateLabel}
                  </button>
                  <Button type="button" variant="outline" size="sm" disabled={pendingAction === "POST_RUN"} onClick={() => void onAnalyze(run.id)}>
                    <Sparkles className="size-4" aria-hidden="true" /> {copy.analyzeRun}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

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

function RunFact({ icon: Icon, label }: { icon: typeof Route; label: string }) {
  return <p className="flex items-center gap-2 text-sm font-bold text-gray-700"><Icon className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />{label}</p>;
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

