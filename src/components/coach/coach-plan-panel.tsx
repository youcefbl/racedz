"use client";

import { useState } from "react";
import { CalendarCheck2, CalendarClock, Check, Clock3, Gauge, PlusCircle, Route, ShieldCheck, Sparkles, X } from "lucide-react";
import { coachRequest } from "@/components/coach/api";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDate, formatEnum, formatPace } from "@/components/coach/format";
import type { CoachLocale, CoachPlan, CoachWorkout } from "@/components/coach/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

// Skip reasons paired with their copy key, in the order shown in the "I can't today" picker.
const SKIP_REASONS: Array<{ value: string; key: keyof CoachCopy }> = [
  { value: "SCHEDULE", key: "skipReasonSchedule" },
  { value: "FATIGUE", key: "skipReasonFatigue" },
  { value: "PAIN_OR_SYMPTOMS", key: "skipReasonPain" },
  { value: "WEATHER", key: "skipReasonWeather" },
  { value: "ILLNESS", key: "skipReasonIllness" },
  { value: "TRAVEL", key: "skipReasonTravel" },
  { value: "MOTIVATION", key: "skipReasonMotivation" },
  { value: "OTHER", key: "skipReasonOther" }
];

const skipReasonLabel = (reason: string | null | undefined, copy: CoachCopy): string | null => {
  const match = SKIP_REASONS.find((r) => r.value === reason);
  // The SKIP_REASONS keys all map to string copy (CoachCopy also holds some array-valued keys).
  return match ? (copy[match.key] as string) : null;
};

// AS_PLANNED needs no note (a plain "Done" says it). Only the notable variants get a localized tag.
const completionTypeLabel = (type: string | null | undefined, copy: CoachCopy): string | null => {
  switch (type) {
    case "PARTIAL":
      return copy.completionPartial;
    case "EASIER_THAN_PLANNED":
      return copy.completionEasier;
    case "HARDER_THAN_PLANNED":
      return copy.completionHarder;
    default:
      return null;
  }
};

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
  onAccept,
  runAction,
  onLogRun
}: {
  plans: CoachPlan[];
  locale: CoachLocale;
  copy: CoachCopy;
  pendingAction: string | null;
  onGenerate: (type: "INITIAL_PLAN" | "WEEKLY_REVIEW") => Promise<void>;
  onAccept: (planId: string) => void;
  // Runs a workout mutation (skip / move) under the dashboard's pending+refresh machinery.
  runAction: (key: string, request: () => Promise<void>) => void;
  // Jump to the run-logging surface for today's session; omitted where logging lives elsewhere (native).
  onLogRun?: () => void;
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
                // Actions only make sense on an active plan's real (persisted) workouts.
                actionable={displayed.status === "ACTIVE" && Boolean(workout.id)}
                planEndsOn={displayed.endsOn}
                pendingAction={pendingAction}
                runAction={runAction}
                onLogRun={onLogRun}
                now={now}
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

// Whole calendar days from today to a workout, for the move-day picker.
function startOfDay(value: Date): Date {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

// One workout in the plan, aware of where it sits relative to today: today's session is highlighted,
// completed ones are ticked with how they went, skipped ones show the reason, and an upcoming session
// on an active plan carries the runner actions (log, "I can't today", move).
function WorkoutRow({
  workout,
  locale,
  copy,
  offset,
  actionable,
  planEndsOn,
  pendingAction,
  runAction,
  onLogRun,
  now
}: {
  workout: CoachWorkout;
  locale: CoachLocale;
  copy: CoachCopy;
  offset: number;
  actionable: boolean;
  planEndsOn: string;
  pendingAction: string | null;
  runAction: (key: string, request: () => Promise<void>) => void;
  onLogRun?: () => void;
  now: Date;
}) {
  const [expander, setExpander] = useState<null | "skip" | "move">(null);

  const status = workout.status ?? "PLANNED";
  const isToday = offset === 0;
  const done = status === "COMPLETED";
  // A skipped workout, or a stale past workout that was never closed, both read as "missed".
  const missed = status === "SKIPPED" || (offset < 0 && status === "PLANNED");
  // Actions only on a still-open, active-plan workout that is today or upcoming.
  const canAct = actionable && status === "PLANNED" && offset >= 0;
  // A missed session with no reason yet — invite the runner to say why (supportive, never shaming).
  const canAddReason = actionable && status === "SKIPPED" && !workout.skipReason;
  const workoutId = workout.id;
  const busy = pendingAction === `wk-${workoutId}`;

  const completionNote = done ? completionTypeLabel(workout.completionType, copy) : null;
  const skipNote = missed ? skipReasonLabel(workout.skipReason, copy) : null;

  const skip = (reason: string | null) => {
    if (!workoutId) return;
    setExpander(null);
    runAction(`wk-${workoutId}`, async () => {
      await coachRequest(`/api/coach/workouts/${workoutId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "skip", reason })
      });
    });
  };

  const move = (date: Date) => {
    if (!workoutId) return;
    setExpander(null);
    runAction(`wk-${workoutId}`, async () => {
      await coachRequest(`/api/coach/workouts/${workoutId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reschedule", scheduledFor: date.toISOString() })
      });
    });
  };

  const setReason = (reason: string) => {
    if (!workoutId) return;
    setExpander(null);
    runAction(`wk-${workoutId}`, async () => {
      await coachRequest(`/api/coach/workouts/${workoutId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reason", reason })
      });
    });
  };

  // Candidate days to move to: today through +6, within the plan window, excluding this workout's own
  // day and anything in the past.
  const today = startOfDay(now);
  const planEnd = startOfDay(new Date(planEndsOn));
  const workoutDay = startOfDay(new Date(workout.scheduledFor)).getTime();
  const moveOptions: Date[] = [];
  for (let i = 0; i <= 6 && moveOptions.length < 5; i += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    if (day.getTime() > planEnd.getTime()) break;
    if (day.getTime() !== workoutDay) moveOptions.push(day);
  }

  return (
    <article
      className={cn(
        "px-5 py-5 transition-colors",
        isToday && "bg-teal-50",
        missed && !isToday && "opacity-70"
      )}
    >
      <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-start">
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
              {completionNote ? <span className="font-semibold text-gray-500">· {completionNote}</span> : null}
            </span>
          ) : missed ? (
            <span className="mt-2 inline-flex flex-wrap items-center gap-1 text-xs font-bold text-gray-500">
              {copy.workoutMissed}
              {skipNote ? <span className="font-semibold">· {skipNote}</span> : null}
            </span>
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
          {workout.targetPaceSecondsPerKm ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
              <Gauge className="size-4 text-brand-orange" aria-hidden="true" />
              {formatPace(workout.targetPaceSecondsPerKm)}
            </span>
          ) : null}
        </div>
      </div>

      {canAct ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isToday && onLogRun ? (
            <Button type="button" size="sm" onClick={onLogRun} disabled={busy}>
              <PlusCircle className="size-4" aria-hidden="true" />
              {copy.logRun}
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => setExpander(expander === "skip" ? null : "skip")}
            disabled={busy}
            aria-expanded={expander === "skip"}
            className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-black text-gray-600 transition hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-50"
          >
            {copy.cantToday}
          </button>
          <button
            type="button"
            onClick={() => setExpander(expander === "move" ? null : "move")}
            disabled={busy || moveOptions.length === 0}
            aria-expanded={expander === "move"}
            className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-black text-gray-600 transition hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-50"
          >
            {copy.moveWorkout}
          </button>
          {busy ? <span className="text-xs font-bold text-gray-500">{copy.savingAction}</span> : null}
        </div>
      ) : null}

      {canAct && expander === "skip" ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-black text-gray-950">{copy.skipTitle}</p>
              <p className="mt-0.5 text-xs leading-5 text-gray-600">{copy.skipEncourage}</p>
            </div>
            <button
              type="button"
              onClick={() => setExpander(null)}
              aria-label={copy.actionCancel}
              className="shrink-0 rounded-md p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SKIP_REASONS.map((reason) => (
              <button
                key={reason.value}
                type="button"
                onClick={() => skip(reason.value)}
                className="inline-flex min-h-9 items-center rounded-full border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              >
                {copy[reason.key]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => skip(null)}
              className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold text-gray-500 underline decoration-gray-300 underline-offset-2 transition hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              {copy.skipNoReason}
            </button>
          </div>
        </div>
      ) : null}

      {canAct && expander === "move" ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-black text-gray-950">{copy.moveTitle}</p>
            <button
              type="button"
              onClick={() => setExpander(null)}
              aria-label={copy.actionCancel}
              className="shrink-0 rounded-md p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {moveOptions.map((day) => (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => move(day)}
                className="inline-flex min-h-9 items-center rounded-full border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              >
                {formatCoachDate(day.toISOString(), locale, { weekday: "short", day: "numeric", month: "short" })}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* A missed session with no reason yet — a gentle, proactive "what came up?" (never shaming). */}
      {canAddReason ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <p className="text-sm font-black text-gray-950">{copy.missedAskReason}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SKIP_REASONS.map((reason) => (
              <button
                key={reason.value}
                type="button"
                onClick={() => setReason(reason.value)}
                disabled={busy}
                className="inline-flex min-h-9 items-center rounded-full border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-50"
              >
                {copy[reason.key]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
