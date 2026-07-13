"use client";

import { CheckCircle2, ChevronRight, Flag, SkipForward } from "lucide-react";
import { formatDuration } from "@/components/coach/format";
import type { GuidanceView } from "@/components/coach/use-workout-guidance";
import type { CoachLocale } from "@/components/coach/types";
import { describeTarget, intensityLabel, roleLabel, type ExecStep, type StepIntensity } from "@/lib/coach/workout-structure";
import { cn } from "@/lib/utils";

const copy = {
  en: { workout: "Guided workout", getReady: "Get ready", stepOf: (a: number, b: number) => `Step ${a} of ${b}`, next: "Next", left: "left", done: "done", complete: "Workout complete", coolDown: "Nice work — keep moving to cool down, then finish when ready.", skip: "Skip step", rep: (a: number, b: number) => `${a}/${b}` },
  fr: { workout: "Séance guidée", getReady: "Préparez-vous", stepOf: (a: number, b: number) => `Étape ${a} / ${b}`, next: "Suivant", left: "restant", done: "fait", complete: "Séance terminée", coolDown: "Beau travail — continuez doucement pour récupérer, puis terminez.", skip: "Passer l'étape", rep: (a: number, b: number) => `${a}/${b}` },
  ar: { workout: "حصة موجَّهة", getReady: "استعد", stepOf: (a: number, b: number) => `الخطوة ${a} من ${b}`, next: "التالي", left: "متبقٍ", done: "تم", complete: "انتهت الحصة", coolDown: "عمل رائع — واصل بلطف للتهدئة ثم أنهِ عند الاستعداد.", skip: "تخطّي الخطوة", rep: (a: number, b: number) => `${a}/${b}` }
} as const;

// Intensity → theme-safe colour set for the current-step card.
const TONE: Record<StepIntensity, { bg: string; border: string; text: string; bar: string; ring: string }> = {
  EASY: { bg: "bg-teal-50", border: "border-teal-200", text: "text-brand-teal", bar: "bg-brand-teal", ring: "text-brand-teal" },
  MODERATE: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", bar: "bg-amber-500", ring: "text-amber-600" },
  HARD: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", bar: "bg-red-500", ring: "text-red-600" }
};

function formatMeters(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 2)} km`;
  return `${Math.round(m)} m`;
}

function bigRemaining(view: GuidanceView): string {
  if (view.unit === "TIME") return formatDuration(Math.round(view.remainingValue ?? 0));
  if (view.unit === "DISTANCE") return formatMeters(view.remainingValue ?? 0);
  return "—";
}

function progressText(view: GuidanceView): string {
  if (view.unit === "TIME") return `${formatDuration(Math.round(view.doneValue))} / ${formatDuration(view.targetValue ?? 0)}`;
  if (view.unit === "DISTANCE") return `${formatMeters(view.doneValue)} / ${formatMeters(view.targetValue ?? 0)}`;
  return "";
}

function StepChip({ step, locale, active, doneMark }: { step: ExecStep; locale: CoachLocale; active: boolean; doneMark: boolean }) {
  const tone = TONE[step.intensity];
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        active ? cn(tone.bg, tone.border) : "border-gray-200 bg-white",
        doneMark && "opacity-55"
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", active ? tone.bar : doneMark ? "bg-gray-300" : "bg-gray-300")} aria-hidden="true" />
      <span className={cn("font-black", active ? tone.text : "text-gray-700")}>
        {roleLabel(step.role, locale)}
        {step.rep ? ` ${copy[locale].rep(step.rep.current, step.rep.total)}` : ""}
      </span>
      <span className="ms-auto font-bold tabular-nums text-gray-500">{describeTarget(step.target, locale)}</span>
      {doneMark ? <CheckCircle2 className="size-4 shrink-0 text-gray-400" aria-hidden="true" /> : null}
    </div>
  );
}

export function WorkoutGuidancePanel({
  view,
  steps,
  locale
}: {
  view: GuidanceView;
  steps: ExecStep[];
  locale: CoachLocale;
}) {
  if (!view.active) return null;
  const t = copy[locale];

  if (view.completed) {
    return (
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-center">
        <CheckCircle2 className="mx-auto size-8 text-brand-teal" aria-hidden="true" />
        <p className="mt-2 text-lg font-black text-gray-950">{t.complete}</p>
        <p className="mt-1 text-sm font-semibold text-gray-600">{t.coolDown}</p>
      </div>
    );
  }

  const current = view.current!;
  const tone = TONE[current.intensity];
  const pct = Math.round(view.progressRatio * 100);

  return (
    <div className={cn("overflow-hidden rounded-xl border shadow-sm", tone.border)}>
      {/* Header strip */}
      <div className={cn("flex items-center gap-2 px-4 py-2", tone.bg)}>
        <Flag className={cn("size-4", tone.text)} aria-hidden="true" />
        <span className={cn("text-xs font-black uppercase tracking-wide", tone.text)}>{t.workout}</span>
        <span className="ms-auto text-xs font-bold text-gray-500">
          {view.notStarted ? t.getReady : t.stepOf(view.stepIndex + 1, view.total)}
        </span>
      </div>

      {/* Current step */}
      <div className="bg-white px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className={cn("truncate text-2xl font-black", tone.text)}>
              {roleLabel(current.role, locale)}
              {current.rep ? <span className="text-gray-400"> · {t.rep(current.rep.current, current.rep.total)}</span> : null}
            </p>
            <p className="mt-0.5 text-sm font-bold text-gray-500">
              {intensityLabel(current.intensity, locale)} · {describeTarget(current.target, locale)}
            </p>
          </div>
          {view.unit !== "OPEN" ? (
            <div className="shrink-0 text-end">
              <p className="text-3xl font-black tabular-nums text-gray-950">{bigRemaining(view)}</p>
              <p className="text-xs font-bold text-gray-400">{t.left}</p>
            </div>
          ) : null}
        </div>

        {/* Progress bar */}
        {view.unit !== "OPEN" ? (
          <div className="mt-3">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className={cn("h-full rounded-full transition-[width] duration-500", tone.bar)} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs font-semibold tabular-nums text-gray-500">{progressText(view)}</p>
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          {view.next ? (
            <p className="flex min-w-0 items-center gap-1 text-sm font-semibold text-gray-500">
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {t.next}: {roleLabel(view.next.role, locale)}
                {view.next.rep ? ` ${t.rep(view.next.rep.current, view.next.rep.total)}` : ""} · {describeTarget(view.next.target, locale)}
              </span>
            </p>
          ) : (
            <span className="grow" />
          )}
          <button
            type="button"
            onClick={view.skip}
            className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-600 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            <SkipForward className="size-3.5" aria-hidden="true" />
            {t.skip}
          </button>
        </div>
      </div>

      {/* Step overview */}
      <div className="grid gap-1.5 border-t border-gray-100 bg-gray-50 px-4 py-3">
        {steps.map((step) => (
          <StepChip
            key={step.index}
            step={step}
            locale={locale}
            active={!view.notStarted && step.index === view.stepIndex}
            doneMark={step.index < view.stepIndex}
          />
        ))}
      </div>
    </div>
  );
}
