"use client";

import { ArrowUpRight, Award, Flame, Footprints, Route as RouteIcon, Timer } from "lucide-react";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDateTime, formatDuration, formatPace } from "@/components/coach/format";
import type { RecordsSummary } from "@/components/coach/records-summary";
import { RunRouteMap } from "@/components/coach/run-route-map";
import type { CoachLocale, CoachRun } from "@/components/coach/types";
import type { Badge } from "@/lib/coach/badges";

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - offset);
  return date;
}

export function RunsOverview({ runs, records, badges, locale, copy }: {
  runs: CoachRun[];
  records: RecordsSummary | null;
  locale: CoachLocale;
  copy: CoachCopy;
  badges?: Badge[];
}) {
  const weekStart = startOfWeek(new Date());
  const weekRuns = runs.filter((run) => new Date(run.startedAt) >= weekStart);
  const weekDistance = weekRuns.reduce((total, run) => total + run.distanceKm, 0);
  const latest = runs[0] ?? null;
  const dateLocale = locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-US";
  const earnedBadges = (badges ?? []).filter((badge) => badge.earned).slice(0, 3);

  return (
    <section className="space-y-4" aria-labelledby="runs-overview-title" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-teal">{copy.runs}</p>
          <h1 id="runs-overview-title" className="mt-1 text-2xl font-black tracking-tight text-[var(--text-strong)]">{copy.runOverviewTitle}</h1>
          <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">{copy.runOverviewSub}</p>
        </div>
        <a href="#run-history" className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-black text-brand-teal transition hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
          {copy.runOverviewBrowse}<ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-5 text-white shadow-sm">
          <div className="absolute -end-10 -top-12 size-36 rounded-full bg-brand-teal/20 blur-2xl" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-white/75">{copy.thisWeek}</p><Flame className="size-5 text-brand-orange" aria-hidden="true" /></div>
            <p className="mt-3 text-4xl font-black tabular-nums tracking-tight">{weekDistance.toFixed(1)}<span className="ms-1 text-base font-bold text-white/60">km</span></p>
            <p className="mt-1 text-sm font-semibold text-white/65">{copy.runCountSummary(weekRuns.length, weekDistance)}</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true"><div className="h-full rounded-full bg-brand-teal" style={{ width: `${Math.min(100, Math.max(8, weekDistance * 4))}%` }} /></div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-[var(--text-muted)]">{copy.thisWeek}</p><Footprints className="size-5 text-brand-teal" aria-hidden="true" /></div>
          <p className="mt-3 text-4xl font-black tabular-nums tracking-tight text-[var(--text-strong)]">{weekRuns.length}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">{copy.runs}</p>
          <div className="mt-5 flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]"><Timer className="size-4 text-brand-orange" aria-hidden="true" />{records?.currentStreakWeeks ? `${records.currentStreakWeeks} ${copy.runOverviewStreak}` : copy.runOverviewEmpty}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">{copy.runOverviewLatest}</p><p className="mt-1 text-base font-black text-[var(--text-strong)]">{latest?.title || (latest ? formatCoachDateTime(latest.startedAt, dateLocale) : copy.runOverviewEmpty)}</p></div>{latest ? <p className="text-xs font-bold text-[var(--text-muted)]">{formatCoachDateTime(latest.startedAt, dateLocale)}</p> : null}</div>
        {latest ? <div className="flex items-center gap-3">
          {latest.route && latest.route.length > 1 ? <RunRouteMap points={latest.route} className="size-20 shrink-0 rounded-xl" /> : <span className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-brand-teal" aria-hidden="true"><RouteIcon className="size-7" /></span>}
          <div className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-[var(--border)] rtl:divide-x-reverse"><OverviewMetric label={copy.statDistance} value={`${latest.distanceKm.toFixed(2)} km`} /><OverviewMetric label={copy.statPace} value={formatPace(latest.averagePaceSecondsPerKm)} /><OverviewMetric label={copy.statTime} value={formatDuration(latest.durationSeconds)} /></div>
        </div> : <p className="rounded-xl bg-[var(--surface-soft)] px-3 py-4 text-sm font-semibold text-[var(--text-muted)]">{copy.runOverviewEmpty}</p>}
      </div>

      {records && records.totalRuns > 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-black text-[var(--text-strong)]">{copy.runOverviewRecords}</p><Award className="size-5 text-brand-orange" aria-hidden="true" /></div>
          <div className="grid grid-cols-3 divide-x divide-[var(--border)] rtl:divide-x-reverse">
            <OverviewMetric label={copy.runOverviewTotalDistance} value={`${records.totalDistanceKm.toFixed(1)} km`} />
            <OverviewMetric label={copy.runOverviewLongest} value={`${records.longestRunKm.toFixed(1)} km`} />
            <OverviewMetric label={copy.runOverviewBestPace} value={records.fastestPace ? formatPace(records.fastestPace.seconds) : "—"} />
          </div>
          {earnedBadges.length > 0 ? <div className="mt-4 flex items-center gap-2 text-xs font-black text-[var(--text-muted)]"><Award className="size-3.5 text-brand-orange" aria-hidden="true" />{copy.runOverviewHighlights}: {copy.runOverviewHighlightCount(earnedBadges.length)}</div> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3"><a href="#run-recorder" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"><Footprints className="size-4" aria-hidden="true" />{copy.recordRun}</a><a href="#run-history" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-black text-[var(--text)] transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"><RouteIcon className="size-4" aria-hidden="true" />{copy.logRun}<ArrowUpRight className="size-4" aria-hidden="true" /></a></div>
    </section>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-2 first:ps-0 last:pe-0"><p className="truncate text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">{label}</p><p className="mt-1 truncate text-sm font-black tabular-nums text-[var(--text-strong)]">{value}</p></div>;
}
