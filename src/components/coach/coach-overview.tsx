import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, Route, Sparkles, Target } from "lucide-react";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDate, formatPace } from "@/components/coach/format";
import type { CoachDashboardData, CoachLocale, CoachPlan } from "@/components/coach/types";
import { Button } from "@/components/ui/button";

export function CoachOverview({
  data,
  latestPlan,
  locale,
  copy,
  onOpenPlan
}: {
  data: CoachDashboardData;
  latestPlan: CoachPlan | null;
  locale: CoachLocale;
  copy: CoachCopy;
  onOpenPlan: () => void;
}) {
  const metrics = data.snapshot?.metrics;
  const nextWorkout = latestPlan?.workouts.find((workout) => workout.status !== "COMPLETED" && new Date(workout.scheduledFor) >= startToday()) ?? null;
  const latestReview = data.interactions.find((interaction) => interaction.response)?.response ?? null;
  const weeklyTarget = Math.max(data.goal?.currentWeeklyDistanceKm ?? 0, 1);
  const progress = Math.min(100, ((metrics?.distanceLast7DaysKm ?? 0) / weeklyTarget) * 100);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase text-brand-teal">{copy.nextWorkout}</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">{nextWorkout?.title ?? copy.noWorkout}</h2>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-brand-orange">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
        </div>
        {nextWorkout ? (
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Fact icon={CalendarDays} value={formatCoachDate(nextWorkout.scheduledFor, locale)} />
              <Fact icon={Route} value={nextWorkout.targetDistanceKm ? `${nextWorkout.targetDistanceKm} km` : "-"} />
              <Fact icon={Clock3} value={nextWorkout.targetDurationMin ? `${nextWorkout.targetDurationMin} min` : nextWorkout.intensity} />
            </div>
            <p className="mt-5 border-t border-gray-200 pt-4 text-sm leading-6 text-gray-600">{nextWorkout.instructions}</p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onOpenPlan}>
              {copy.plan} <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div className="p-5">
            <Button type="button" onClick={onOpenPlan}>{copy.generatePlan}</Button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Target className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-base font-black text-gray-950">{copy.thisWeek}</h2>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <p className="text-3xl font-black text-gray-950">{metrics?.distanceLast7DaysKm.toFixed(1) ?? "0.0"} km</p>
          <p className="text-sm font-bold text-gray-500">/ {weeklyTarget.toFixed(1)} km</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" aria-label={`${Math.round(progress)}%`}>
          <div className="h-full rounded-full bg-brand-orange transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-200 pt-4">
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">{copy.runs}</p>
            <p className="mt-1 text-lg font-black text-gray-950">{metrics?.runCountLast7Days ?? 0}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">{copy.avgPace}</p>
            <p className="mt-1 text-lg font-black text-gray-950">{formatPace(metrics?.averagePaceLast28DaysSecondsPerKm ?? null)}</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:col-span-2">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
          <Sparkles className="size-5 text-brand-orange" aria-hidden="true" />
          <h2 className="text-base font-black text-gray-950">{copy.recentCoach}</h2>
        </div>
        {latestReview ? (
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div>
              <p className="text-sm leading-6 text-gray-700">{latestReview.summary}</p>
              <p className="mt-3 text-sm leading-6 text-gray-600">{latestReview.progressAssessment}</p>
            </div>
            <div className="space-y-3">
              {latestReview.positiveSignals.map((signal) => (
                <p key={signal} className="flex gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" /> {signal}
                </p>
              ))}
              {latestReview.warningSignals.map((signal) => (
                <p key={signal} className="flex gap-2 text-sm text-gray-700">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-orange" aria-hidden="true" /> {signal}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <p className="p-5 text-sm text-gray-600">{copy.noReview}</p>
        )}
      </section>
    </div>
  );
}

function Fact({ icon: Icon, value }: { icon: typeof CalendarDays; value: string }) {
  return <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-gray-700"><Icon className="size-4 shrink-0 text-brand-teal" aria-hidden="true" /><span className="truncate">{value}</span></p>;
}

function startToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

