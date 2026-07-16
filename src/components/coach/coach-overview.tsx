"use client";

import { Activity, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Lightbulb, PlusCircle, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDate, formatEnum, formatPace } from "@/components/coach/format";
import type { CoachDashboardData, CoachLocale, CoachMetrics, CoachPlan, CoachWorkout } from "@/components/coach/types";
import { Button } from "@/components/ui/button";

export function CoachOverview({
  data,
  latestPlan,
  locale,
  copy,
  tips,
  metrics,
  onOpenPlan,
  onLogWorkout
}: {
  data: CoachDashboardData;
  latestPlan: CoachPlan | null;
  locale: CoachLocale;
  copy: CoachCopy;
  tips?: string[];
  metrics: CoachMetrics;
  onOpenPlan: () => void;
  // Tapping the Today hero's primary action: log a run against this workout (web; native logs elsewhere).
  onLogWorkout?: (workoutId: string) => void;
}) {
  const today = startToday().getTime();
  const dayOf = (iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const todayWorkout = latestPlan?.workouts.find((workout) => dayOf(workout.scheduledFor) === today) ?? null;
  const nextUpcoming = latestPlan?.workouts.find((workout) => workout.status !== "COMPLETED" && dayOf(workout.scheduledFor) > today) ?? null;
  // A real session to do today (not a rest day, not already done): the one clear action.
  const loggableToday = todayWorkout && todayWorkout.status !== "COMPLETED" && todayWorkout.workoutType !== "REST" ? todayWorkout : null;
  const latestReview = data.interactions.find((interaction) => interaction.response)?.response ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Today hero: the one clear action for right now. */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
        {loggableToday ? (
          <TodayHero workout={loggableToday} locale={locale} copy={copy} onOpenPlan={onOpenPlan} onLogWorkout={onLogWorkout} />
        ) : todayWorkout?.status === "COMPLETED" ? (
          <HeroMessage
            eyebrow={copy.today}
            title={copy.todayDoneTitle}
            text={copy.todayDoneText}
            done
            onOpenPlan={onOpenPlan}
            copy={copy}
          />
        ) : todayWorkout?.workoutType === "REST" ? (
          <HeroMessage eyebrow={copy.today} title={copy.restDayTitle} text={copy.restDayText} onOpenPlan={onOpenPlan} copy={copy} />
        ) : nextUpcoming ? (
          <UpcomingHero workout={nextUpcoming} locale={locale} copy={copy} onOpenPlan={onOpenPlan} />
        ) : latestPlan ? (
          <HeroMessage eyebrow={copy.today} title={copy.noSessionToday} text={copy.restDayText} onOpenPlan={onOpenPlan} copy={copy} />
        ) : metrics.runCountLast28Days > 0 ? (
          // Free-runner (goal + runs, no active plan): a read on their actual training + a soft invite.
          <FreeRunnerRead metrics={metrics} copy={copy} onOpenPlan={onOpenPlan} />
        ) : (
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-wide text-brand-teal">{copy.nextWorkout}</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">{copy.noWorkout}</h2>
            <p className="mb-4 mt-2 text-sm leading-6 text-gray-600">{copy.noReview}</p>
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

// Today's session with the one clear action: log it. The primary CTA is wired to the run form
// (preselecting this workout); "View plan" stays as the calmer secondary.
function TodayHero({
  workout,
  copy,
  onOpenPlan,
  onLogWorkout
}: {
  workout: CoachWorkout;
  locale: CoachLocale;
  copy: CoachCopy;
  onOpenPlan: () => void;
  onLogWorkout?: (workoutId: string) => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-5">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-brand-teal">{copy.today}</p>
          <h2 className="mt-1 text-xl font-black text-gray-950">{workout.title}</h2>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
          <CalendarDays className="size-6" aria-hidden="true" />
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-3 divide-x divide-gray-200 rounded-lg bg-gray-50 py-2.5">
          <OverviewStat label={copy.distance} value={workout.targetDistanceKm ? `${workout.targetDistanceKm} km` : "—"} accent />
          <OverviewStat
            label={workout.targetDurationMin ? copy.durationMinutes : copy.effort}
            value={workout.targetDurationMin ? `${workout.targetDurationMin} min` : workout.intensity}
          />
          <OverviewStat label={copy.plan} value={formatEnum(workout.workoutType)} />
        </div>
        <p className="mt-4 text-sm leading-6 text-gray-600">{workout.instructions}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {onLogWorkout && workout.id ? (
            <Button type="button" onClick={() => onLogWorkout(workout.id as string)}>
              <PlusCircle className="size-4" aria-hidden="true" />
              {copy.logThisRun}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onOpenPlan}>
            {copy.viewPlan} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </>
  );
}

// Nothing to do today, but a session is coming up — show it so the runner knows what's next.
function UpcomingHero({
  workout,
  locale,
  copy,
  onOpenPlan
}: {
  workout: CoachWorkout;
  locale: CoachLocale;
  copy: CoachCopy;
  onOpenPlan: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-5">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-brand-teal">{copy.nextWorkout}</p>
          <h2 className="mt-1 text-xl font-black text-gray-950">{workout.title}</h2>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
          <CalendarDays className="size-6" aria-hidden="true" />
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm font-semibold text-gray-500">{copy.noSessionToday}</p>
        <div className="mt-3 grid grid-cols-3 divide-x divide-gray-200 rounded-lg bg-gray-50 py-2.5">
          <OverviewStat label={copy.startedAt} value={formatCoachDate(workout.scheduledFor, locale, { weekday: "short", day: "numeric", month: "short" })} />
          <OverviewStat label={copy.distance} value={workout.targetDistanceKm ? `${workout.targetDistanceKm} km` : "—"} accent />
          <OverviewStat
            label={workout.targetDurationMin ? copy.durationMinutes : copy.effort}
            value={workout.targetDurationMin ? `${workout.targetDurationMin} min` : workout.intensity}
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-gray-600">{workout.instructions}</p>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onOpenPlan}>
          {copy.viewPlan} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}

// A simple message state for the hero (today's done, a rest day, or nothing scheduled).
function HeroMessage({
  eyebrow,
  title,
  text,
  done = false,
  onOpenPlan,
  copy
}: {
  eyebrow: string;
  title: string;
  text: string;
  done?: boolean;
  onOpenPlan: () => void;
  copy: CoachCopy;
}) {
  return (
    <div className="p-5">
      <p className="text-xs font-black uppercase tracking-wide text-brand-teal">{eyebrow}</p>
      <h2 className="mt-1 inline-flex items-center gap-2 text-xl font-black text-gray-950">
        {done ? <CheckCircle2 className="size-5 shrink-0 text-green-600" aria-hidden="true" /> : null}
        {title}
      </h2>
      <p className="mb-4 mt-2 text-sm leading-6 text-gray-600">{text}</p>
      <Button type="button" variant="outline" size="sm" onClick={onOpenPlan}>
        {copy.viewPlan} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Button>
    </div>
  );
}

// The free-runner's home: a read on their actual training from run history alone (volume this week +
// trend, consistency over 4 weeks, average pace), plus a soft, framed invitation to build a plan.
// Never nags — it acknowledges what they're already doing.
function FreeRunnerRead({
  metrics,
  copy,
  onOpenPlan
}: {
  metrics: CoachMetrics;
  copy: CoachCopy;
  onOpenPlan: () => void;
}) {
  const change = metrics.weeklyDistanceChangePercent;
  const trend = change === null ? null : `${change > 0 ? "+" : ""}${Math.round(change)}%`;

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-5">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-brand-teal">{copy.trainingSoFar}</p>
          <p className="mt-1 text-sm leading-6 text-gray-600">{copy.freeRunnerIntro}</p>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-teal">
          <Activity className="size-6" aria-hidden="true" />
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-3 divide-x divide-gray-200 rounded-lg bg-gray-50 py-2.5">
          <OverviewStat
            label={copy.thisWeek}
            value={`${metrics.distanceLast7DaysKm.toFixed(1)} km${trend ? ` · ${trend}` : ""}`}
            accent
          />
          <OverviewStat label={copy.freeRunnerRunsLabel} value={copy.freeRunnerRunsValue.replace("{count}", String(metrics.runCountLast28Days))} />
          <OverviewStat label={copy.avgPace} value={formatPace(metrics.averagePaceLast28DaysSecondsPerKm)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-teal-50 p-3">
          <p className="text-sm font-black text-gray-950">{copy.freeRunnerInvite}</p>
          <Button type="button" size="sm" onClick={onOpenPlan}>
            <Sparkles className="size-4" aria-hidden="true" />
            {copy.buildMyPlan}
          </Button>
        </div>
      </div>
    </>
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
