"use client";

import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDate } from "@/components/coach/format";
import type { CoachDashboardData, CoachLocale, CoachPlan } from "@/components/coach/types";
import { Button } from "@/components/ui/button";

export function CoachOverview({
  data,
  latestPlan,
  locale,
  copy,
  tips,
  onOpenPlan
}: {
  data: CoachDashboardData;
  latestPlan: CoachPlan | null;
  locale: CoachLocale;
  copy: CoachCopy;
  tips?: string[];
  onOpenPlan: () => void;
}) {
  const nextWorkout = latestPlan?.workouts.find((workout) => workout.status !== "COMPLETED" && new Date(workout.scheduledFor) >= startToday()) ?? null;
  const latestReview = data.interactions.find((interaction) => interaction.response)?.response ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Hero: the next thing to do — the one clear action on this screen */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-brand-teal">{copy.nextWorkout}</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">{nextWorkout?.title ?? copy.noWorkout}</h2>
          </div>
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
            <CalendarDays className="size-6" aria-hidden="true" />
          </div>
        </div>
        {nextWorkout ? (
          <div className="p-5">
            <div className="grid grid-cols-3 divide-x divide-gray-200 rounded-lg bg-gray-50 py-2.5">
              <OverviewStat label={copy.startedAt} value={formatCoachDate(nextWorkout.scheduledFor, locale, { weekday: "short", day: "numeric", month: "short" })} />
              <OverviewStat label={copy.distance} value={nextWorkout.targetDistanceKm ? `${nextWorkout.targetDistanceKm} km` : "—"} accent />
              <OverviewStat label={nextWorkout.targetDurationMin ? copy.durationMinutes : copy.effort} value={nextWorkout.targetDurationMin ? `${nextWorkout.targetDurationMin} min` : nextWorkout.intensity} />
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-600">{nextWorkout.instructions}</p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onOpenPlan}>
              {copy.plan} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div className="p-5">
            <p className="mb-4 text-sm leading-6 text-gray-600">{copy.noReview}</p>
            <Button type="button" onClick={onOpenPlan}>{copy.generatePlan}</Button>
          </div>
        )}
      </section>

      {/* The coach's latest word */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-brand-orange" aria-hidden="true" />
          <h2 className="text-base font-black text-gray-950">{copy.recentCoach}</h2>
        </div>
        {latestReview ? (
          <div className="mt-3">
            <p className="text-sm leading-6 text-gray-700">{latestReview.summary}</p>
            <div className="mt-3 space-y-2">
              {latestReview.positiveSignals.slice(0, 2).map((signal) => (
                <p key={signal} className="flex gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" /> {signal}
                </p>
              ))}
              {latestReview.warningSignals.slice(0, 2).map((signal) => (
                <p key={signal} className="flex gap-2 text-sm text-gray-700">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-orange" aria-hidden="true" /> {signal}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">{copy.noReview}</p>
        )}
      </section>

      <CoachTip tips={tips} copy={copy} />
    </div>
  );
}

function OverviewStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 px-3 text-center">
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-black ${accent ? "text-brand-teal" : "text-gray-950"}`}>{value}</p>
    </div>
  );
}

function CoachTip({ tips, copy }: { tips?: string[]; copy: CoachCopy }) {
  // Prefer DB-backed tips (matched to the runner's profile); fall back to built-in copy tips
  // so the card is never empty. Start deterministically (0) to match SSR, then randomise.
  const list = tips && tips.length > 0 ? tips : copy.tips;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(Math.floor(Math.random() * list.length));
  }, [list.length]);
  const tip = list[index % list.length];

  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-5 text-brand-teal" aria-hidden="true" />
        <h2 className="text-base font-black text-gray-950">{copy.tipTitle}</h2>
      </div>
      <p className="mt-3 flex-1 text-sm leading-6 text-gray-700">{tip}</p>
      <button
        type="button"
        onClick={() => setIndex((current) => (current + 1) % list.length)}
        className="mt-4 inline-flex min-h-11 items-center gap-1.5 self-start rounded-md border border-gray-300 px-3 py-1.5 text-xs font-black text-gray-700 transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        <RefreshCw className="size-3.5" aria-hidden="true" />
        {copy.newTip}
      </button>
    </section>
  );
}

function startToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
