"use client";

import { CalendarCheck2, ChevronRight, RotateCcw } from "lucide-react";
import type { CoachCopy } from "@/components/coach/copy";
import type { CoachAdherence } from "@/components/coach/types";

// Plan-adherence at a glance: how much of the active plan the runner has actually completed this
// week. Complements the "This week" volume block above it (that's logged running; this is plan
// completion). Deliberately calm and non-punitive — a missed streak is a gentle "let's get back to
// it", never a red failure. A free runner (no active plan) sees a soft prompt, never 0%.
export function AdherenceStrip({
  adherence,
  copy,
  onOpenPlan
}: {
  adherence?: CoachAdherence;
  copy: CoachCopy;
  onOpenPlan: () => void;
}) {
  // No active plan → a calm, tappable prompt toward the plan. Never a discouraging 0%.
  if (!adherence?.hasActivePlan) {
    return (
      <button
        type="button"
        onClick={onOpenPlan}
        className="mb-5 flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-start shadow-sm transition hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
          <CalendarCheck2 className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-gray-950">{copy.noActivePlanTitle}</span>
          <span className="block text-xs leading-5 text-gray-600">{copy.noActivePlanText}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-gray-500 rtl:rotate-180" aria-hidden="true" />
      </button>
    );
  }

  const { completedSessions, plannedSessions, completedDistanceKm, plannedDistanceKm, consecutiveMissed } = adherence;
  const pct = plannedSessions > 0 ? Math.min(100, Math.round((completedSessions / plannedSessions) * 100)) : 0;

  return (
    <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-wide text-gray-500">{copy.planThisWeek}</h2>
        <button
          type="button"
          onClick={onOpenPlan}
          className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs font-black text-brand-teal transition hover:text-brand-tealDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
        >
          {copy.viewPlan}
          <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <p className="text-lg font-black tabular-nums text-gray-950">
          {completedSessions}
          <span className="text-gray-500"> / {plannedSessions}</span>{" "}
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{copy.adherenceComplete}</span>
        </p>
        <p className="text-sm font-black tabular-nums text-gray-700">
          {completedDistanceKm.toFixed(1)} / {plannedDistanceKm.toFixed(1)} km{" "}
          <span className="text-xs font-bold text-gray-500">{copy.adherencePlanned}</span>
        </p>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label={copy.planThisWeek}
        aria-valuenow={pct}
        aria-valuetext={`${completedSessions} / ${plannedSessions}`}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-brand-teal transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* A missed streak is surfaced gently, in neutral gray — informative, not a red failure. */}
      {consecutiveMissed >= 2 ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {consecutiveMissed} {copy.adherenceMissedRow}
        </p>
      ) : null}
    </section>
  );
}
