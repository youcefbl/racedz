"use client";

import { Moon, Plus, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { coachRequest } from "@/components/coach/api";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDate } from "@/components/coach/format";
import type { CoachLocale, CoachSleepEntry } from "@/components/coach/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SleepMode = "hours" | "times" | "text";

// Nightly sleep tracker. Three ways to enter a night — a plain hours count, a bed/wake time range,
// or a free-text note in any language the AI turns into a duration — then a history of recent
// nights with a simple bar so the runner can see their sleep at a glance. Mirrors CoachRunsPanel.
export function CoachSleepPanel({
  entries,
  locale,
  copy,
  onSaved
}: {
  entries: CoachSleepEntry[];
  locale: CoachLocale;
  copy: CoachCopy;
  pendingAction: string | null;
  onSaved: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(entries.length === 0);
  const [mode, setMode] = useState<SleepMode>("hours");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const averageHours = useMemo(() => {
    const lastSeven = entries.slice(0, 7);
    if (lastSeven.length === 0) return null;
    const total = lastSeven.reduce((sum, entry) => sum + entry.durationMinutes, 0);
    return Math.round((total / lastSeven.length / 60) * 10) / 10;
  }, [entries]);

  function submit(formData: FormData) {
    setError(null);
    setSuccess(null);

    // Only send the fields for the active mode, so the server picks the right resolution path.
    const body: Record<string, unknown> = { night: optionalString(formData, "night") };
    if (mode === "hours") {
      body.durationHours = Number(formData.get("durationHours"));
    } else if (mode === "times") {
      body.bedTime = optionalString(formData, "bedTime");
      body.wakeTime = optionalString(formData, "wakeTime");
    } else {
      body.text = optionalString(formData, "text");
    }
    const note = optionalString(formData, "note");
    if (note) body.note = note;

    startSaving(async () => {
      try {
        await coachRequest<{ data: CoachSleepEntry }>("/api/coach/sleep", {
          method: "POST",
          body: JSON.stringify(body)
        });
        setSuccess(copy.sleepSaved);
        setShowForm(false);
        await onSaved();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : copy.sleepSaveFailed);
      }
    });
  }

  const longestMinutes = useMemo(
    () => entries.reduce((max, entry) => Math.max(max, entry.durationMinutes), 0),
    [entries]
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-gray-950">{copy.sleepHeading}</h2>
          <p className="mt-0.5 text-sm leading-6 text-gray-600">{copy.sleepIntro}</p>
        </div>
        {averageHours != null ? (
          <div className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{copy.sleepAvgLabel}</p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-brand-teal">
              {averageHours}
              {copy.hoursUnit}
            </p>
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            aria-expanded={showForm}
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-brand-teal shadow-sm transition hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            <Plus className={cn("size-4 transition-transform", showForm && "rotate-45")} aria-hidden="true" />
            {copy.logSleep}
          </button>
        </div>

        {showForm ? (
          <form action={submit} className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {/* Mode switch — hours / times / describe */}
            <div className="mb-5 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              {(
                [
                  ["hours", copy.sleepModeHours],
                  ["times", copy.sleepModeTimes],
                  ["text", copy.sleepModeText]
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "min-h-9 rounded-md px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                    mode === value ? "bg-white text-brand-teal shadow-sm" : "text-gray-500 hover:text-gray-800"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={copy.sleepNight}>
                <input name="night" type="date" defaultValue={today()} max={today()} className={inputClass} />
              </Field>

              {mode === "hours" ? (
                <Field label={copy.sleepHoursLabel}>
                  <input name="durationHours" type="number" min="0" max="24" step="0.25" required className={inputClass} />
                </Field>
              ) : null}

              {mode === "times" ? (
                <>
                  <Field label={copy.sleepBedTime}>
                    <input name="bedTime" type="time" required className={inputClass} />
                  </Field>
                  <Field label={copy.sleepWakeTime}>
                    <input name="wakeTime" type="time" required className={inputClass} />
                  </Field>
                </>
              ) : null}

              {mode === "text" ? (
                <Field label={copy.sleepTextLabel} className="sm:col-span-2">
                  <div className="relative">
                    <input name="text" maxLength={300} required placeholder={copy.sleepTextPlaceholder} className={cn(inputClass, "pe-9")} />
                    <Sparkles className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-brand-orange" aria-hidden="true" />
                  </div>
                </Field>
              ) : null}

              <Field label={copy.sleepNoteLabel} className="sm:col-span-2">
                <input name="note" maxLength={300} className={inputClass} />
              </Field>
            </div>

            <div className="mt-5 flex justify-end border-t border-gray-200 pt-5">
              <Button type="submit" disabled={saving}>
                {saving ? copy.savingSleep : copy.saveSleep}
              </Button>
            </div>
          </form>
        ) : null}

        {success ? <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{success}</p> : null}
        {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-50 text-brand-orange">
              <Moon className="size-6" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-gray-600">{copy.noSleep}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <SleepRow key={entry.id} entry={entry} locale={locale} copy={copy} longestMinutes={longestMinutes} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SleepRow({
  entry,
  locale,
  copy,
  longestMinutes
}: {
  entry: CoachSleepEntry;
  locale: CoachLocale;
  copy: CoachCopy;
  longestMinutes: number;
}) {
  const hours = Math.floor(entry.durationMinutes / 60);
  const minutes = entry.durationMinutes % 60;
  // Bar scaled to the runner's own longest logged night, so the history reads as a relative trend.
  const width = longestMinutes > 0 ? Math.round((entry.durationMinutes / longestMinutes) * 100) : 0;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="w-24 shrink-0">
        <p className="truncate text-sm font-black text-gray-950">
          {formatCoachDate(entry.night, locale, { month: "short", day: "numeric" })}
        </p>
        {entry.bedTime && entry.wakeTime ? (
          <p className="truncate text-[11px] font-semibold text-gray-500 tabular-nums">
            {entry.bedTime}–{entry.wakeTime}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-teal transition-all" style={{ width: `${width}%` }} />
        </div>
        {entry.note ? <p className="mt-1 truncate text-xs font-medium text-gray-500">{entry.note}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {entry.source === "PARSED" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase text-brand-orangeText" title={copy.sleepModeText}>
            <Sparkles className="size-3" aria-hidden="true" />
            {copy.sleepAiBadge}
          </span>
        ) : null}
        <p className="w-14 text-end text-sm font-black tabular-nums text-gray-950">
          {hours}
          {copy.hoursUnit}
          {minutes > 0 ? ` ${String(minutes).padStart(2, "0")}` : ""}
        </p>
      </div>
    </li>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid min-w-0 gap-2 text-sm font-bold text-gray-800 ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20";

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

// Today's local date as YYYY-MM-DD for the <input type="date"> default and max.
function today() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 10);
}
