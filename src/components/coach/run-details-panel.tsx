"use client";

import { Activity, Flame, Footprints, HeartPulse, Mountain, Route as RouteIcon, Timer, type LucideIcon } from "lucide-react";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDateTime, formatDuration, formatPace } from "@/components/coach/format";
import { RunSummary } from "@/components/coach/run-summary";
import type { CoachLocale, CoachRun, RunRoutePoint } from "@/components/coach/types";
import { computeSplits } from "@/lib/coach/run-stats";

export function RunDetailsPanel({ run, route, locale, copy }: {
  run: CoachRun;
  route: RunRoutePoint[];
  locale: CoachLocale;
  copy: CoachCopy;
}) {
  const splits = computeSplits(route);
  const firstSplit = splits[0]?.paceSecondsPerKm ?? null;
  const lastSplit = splits.at(-1)?.paceSecondsPerKm ?? null;
  const pace = formatPace(run.averagePaceSecondsPerKm);
  const insight =
    firstSplit != null && lastSplit != null && lastSplit < firstSplit - 10
      ? copy.runDetailsInsightFastFinish(formatPace(lastSplit))
      : firstSplit != null && lastSplit != null && Math.abs(lastSplit - firstSplit) <= 20
        ? copy.runDetailsInsightSteady(pace)
        : copy.runDetailsInsightVariable;
  const recovery = run.perceivedEffort >= 7 || run.painLevel >= 5 ? copy.runDetailsRecommendationRest : copy.runDetailsRecommendationEasy;
  const dateLocale = locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-US";

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] text-white">
        <div className="relative p-5">
          <div className="absolute -end-10 -top-16 size-40 rounded-full bg-brand-teal/20 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">{copy.runDetailsStats}</p>
                <h3 className="mt-1 truncate text-xl font-black">{run.title || formatCoachDateTime(run.startedAt, dateLocale)}</h3>
                <p className="mt-1 text-xs font-semibold text-white/60">{formatCoachDateTime(run.startedAt, dateLocale)}</p>
              </div>
              <RouteIcon className="mt-1 size-5 shrink-0 text-brand-teal" aria-hidden="true" />
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rtl:divide-x-reverse">
              <HeroMetric label={copy.statDistance} value={`${run.distanceKm.toFixed(2)} km`} />
              <HeroMetric label={copy.statPace} value={pace} />
              <HeroMetric label={copy.statTime} value={formatDuration(run.durationSeconds)} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard icon={Activity} title={copy.runDetailsInsightTitle} text={insight} tone="teal" />
        <InsightCard icon={Timer} title={copy.runDetailsRecommendationTitle} text={recovery} tone="orange" />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-brand-teal"><Activity className="size-4" aria-hidden="true" /></span>
          <h3 className="text-sm font-black text-[var(--text-strong)]">{copy.runDetailsHighlights}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Highlight icon={Activity} label={copy.runDetailsEffort} value={`${run.perceivedEffort}/10`} />
          <Highlight icon={HeartPulse} label={copy.runDetailsHeartRate} value={run.averageHeartRate ? `${run.averageHeartRate} bpm` : "—"} />
          <Highlight icon={Footprints} label={copy.runDetailsCadence} value={run.avgCadence ? `${run.avgCadence} spm` : "—"} />
          <Highlight icon={Mountain} label={copy.runDetailsElevation} value={run.elevationGainM != null ? `${run.elevationGainM} m` : "—"} />
        </div>
        {run.calories != null ? <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]"><Flame className="size-3.5 text-brand-orange" aria-hidden="true" />{copy.runDetailsCalories}: {run.calories} kcal</p> : null}
      </div>

      <RunSummary
        points={route}
        distanceKm={run.distanceKm}
        durationSeconds={run.durationSeconds}
        movingSeconds={run.movingTimeSeconds ?? run.durationSeconds}
        avgPaceSecondsPerKm={run.averagePaceSecondsPerKm}
        elevationGainM={run.elevationGainM}
        avgCadence={run.avgCadence}
        calories={run.calories}
        copy={copy}
        showStats={false}
      />
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-2 first:ps-0 last:pe-0"><p className="truncate text-[10px] font-black uppercase tracking-wide text-white/55">{label}</p><p className="mt-1 truncate text-lg font-black tabular-nums">{value}</p></div>;
}

function InsightCard({ icon: Icon, title, text, tone }: { icon: LucideIcon; title: string; text: string; tone: "teal" | "orange" }) {
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center gap-2"><span className={`flex size-8 items-center justify-center rounded-lg ${tone === "teal" ? "bg-[var(--primary-soft)] text-brand-teal" : "bg-[var(--accent-soft)] text-brand-orange"}`}><Icon className="size-4" aria-hidden="true" /></span><h3 className="text-sm font-black text-[var(--text-strong)]">{title}</h3></div><p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-muted)]">{text}</p></div>;
}

function Highlight({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-2"><p className="flex items-center gap-1.5 truncate text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]"><Icon className="size-3.5 shrink-0 text-brand-teal" aria-hidden="true" />{label}</p><p className="mt-1 text-sm font-black tabular-nums text-[var(--text-strong)]">{value}</p></div>;
}
