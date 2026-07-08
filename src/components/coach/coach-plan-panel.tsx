"use client";

import { CalendarCheck2, CalendarClock, Check, Clock3, Route, ShieldCheck, Sparkles } from "lucide-react";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDate, formatEnum } from "@/components/coach/format";
import type { CoachLocale, CoachPlan, CoachWorkout } from "@/components/coach/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole calendar days from today to a workout's date: 0 = today, <0 = past, >0 = upcoming.
function daysFromToday(dateIso: string, now: Date): number {
  const start = (value: Date) => {
    const day = new Date(value);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
  };
  return Math.round((start(new Date(dateIso)) - start(now)) / DAY_MS);
}

export function CoachPlanPanel({
  plans,
  locale,
  copy,
  pendingAction,
  onGenerate,
  onAccept
}: {
  plans: CoachPlan[];
  locale: CoachLocale;
  copy: CoachCopy;
  pendingAction: string | null;
  onGenerate: (type: "INITIAL_PLAN" | "WEEKLY_REVIEW") => Promise<void>;
  onAccept: (planId: string) => void;
}) {
  const now = new Date();
  const draft = plans.find((plan) => plan.status === "DRAFT") ?? null;
  const active = plans.find((plan) => plan.status === "ACTIVE") ?? null;
  const displayed = draft ?? active;
  const generating = pendingAction === "INITIAL_PLAN" || pendingAction === "WEEKLY_REVIEW";
  // The shown plan is active but its whole week has already passed, and no newer week is drafted —
  // so there's nothing scheduled for today. Prompt the runner to generate the current week.
  const planEnded = Boolean(displayed && displayed.status === "ACTIVE" && daysFromToday(displayed.endsOn, now) < 0);

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="size-5 text-brand-teal" aria-hidden="true" />
            <h2 className="text-xl font-black text-gray-950">{displayed?.status === "ACTIVE" ? copy.activePlan : copy.draftPlan}</h2>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {displayed ? `${formatCoachDate(displayed.startsOn, locale)} - ${formatCoachDate(displayed.endsOn, locale)}` : copy.noWorkout}
          </p>
        </div>
        <Button
          type="button"
          variant={displayed ? "outline" : "primary"}
          disabled={generating}
          onClick={() => void onGenerate(plans.length > 0 ? "WEEKLY_REVIEW" : "INITIAL_PLAN")}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {generating ? copy.generating : plans.length > 0 ? copy.reviewPlan : copy.generatePlan}
        </Button>
      </div>

      {planEnded ? (
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-orange-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-brand-orange" aria-hidden="true" />
            <div>
              <p className="text-sm font-black text-gray-950">{copy.planEndedTitle}</p>
              <p className="mt-0.5 text-sm leading-6 text-gray-700">{copy.planEndedText}</p>
            </div>
          </div>
          <Button type="button" size="sm" className="shrink-0" disabled={generating} onClick={() => void onGenerate("WEEKLY_REVIEW")}>
            <Sparkles className="size-4" aria-hidden="true" />
            {generating ? copy.generating : copy.reviewPlan}
          </Button>
        </div>
      ) : null}

      {displayed ? (
        <>
          <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={displayed.status === "ACTIVE" ? "green" : "orange"}>{formatEnum(displayed.status)}</Badge>
              <span className="text-xs font-bold text-gray-500">v{displayed.version}</span>
            </div>
            {displayed.status === "DRAFT" ? (
              <Button type="button" size="sm" disabled={pendingAction === "ACCEPT_PLAN"} onClick={() => onAccept(displayed.id)}>
                <Check className="size-4" aria-hidden="true" />
                {copy.acceptPlan}
              </Button>
            ) : null}
          </div>
          {displayed.summary ? <p className="border-b border-gray-200 px-5 py-4 text-sm leading-6 text-gray-600">{displayed.summary}</p> : null}
          <div className="divide-y divide-gray-200">
            {displayed.workouts.map((workout, index) => (
              <WorkoutRow
                key={workout.id ?? `${workout.scheduledFor}-${index}`}
                workout={workout}
                locale={locale}
                copy={copy}
                offset={daysFromToday(workout.scheduledFor, now)}
              />
            ))}
          </div>
          <div className="flex items-start gap-2 border-t border-gray-200 bg-teal-50 px-5 py-4 text-xs leading-5 text-gray-700">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden="true" />
            {copy.planSafetyNotice}
          </div>
        </>
      ) : (
        <div className="px-5 py-12 text-center">
          <CalendarCheck2 className="mx-auto size-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 text-sm text-gray-600">{copy.noWorkout}</p>
        </div>
      )}
    </section>
  );
}

// One workout in the plan, aware of where it sits relative to today: today's session is
// highlighted, completed ones are ticked, and a past session that wasn't done is marked missed
// and dimmed — so the current week reads at a glance.
function WorkoutRow({
  workout,
  locale,
  copy,
  offset
}: {
  workout: CoachWorkout;
  locale: CoachLocale;
  copy: CoachCopy;
  offset: number;
}) {
  const isToday = offset === 0;
  const done = workout.status === "COMPLETED";
  const missed = offset < 0 && !done;

  return (
    <article
      className={cn(
        "grid gap-4 px-5 py-5 transition-colors sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-start",
        isToday && "bg-teal-50",
        missed && "opacity-70"
      )}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-gray-950">
            {formatCoachDate(workout.scheduledFor, locale, { weekday: "short", day: "numeric", month: "short" })}
          </p>
          {isToday ? (
            <span className="rounded-full bg-brand-teal px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
              {copy.today}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs font-bold uppercase text-brand-teal">{formatEnum(workout.workoutType)}</p>
        {done ? (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-green-600">
            <Check className="size-3.5" aria-hidden="true" />
            {copy.workoutDone}
          </span>
        ) : missed ? (
          <span className="mt-2 inline-flex text-xs font-bold text-gray-500">{copy.workoutMissed}</span>
        ) : null}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-black text-gray-950">{workout.title}</h3>
        <p className="mt-1 text-sm font-semibold text-gray-600">{workout.intensity}</p>
        <p className="mt-2 text-sm leading-6 text-gray-600">{workout.instructions}</p>
      </div>
      <div className="flex gap-3 text-sm font-black text-gray-700 sm:flex-col sm:items-end">
        {workout.targetDistanceKm ? (
          <span className="inline-flex items-center gap-1">
            <Route className="size-4 text-brand-orange" aria-hidden="true" />
            {workout.targetDistanceKm} km
          </span>
        ) : null}
        {workout.targetDurationMin ? (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-4 text-brand-orange" aria-hidden="true" />
            {workout.targetDurationMin} min
          </span>
        ) : null}
      </div>
    </article>
  );
}
