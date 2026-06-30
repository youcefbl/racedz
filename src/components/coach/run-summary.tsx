"use client";

import type { CoachCopy } from "@/components/coach/copy";
import { formatDuration, formatPace } from "@/components/coach/format";
import type { RunRoutePoint } from "@/components/coach/types";
import { computeSplits, elevationSeries, estimateCalories, paceSeries, smoothedElevationGainM, type SeriesPoint } from "@/lib/coach/run-stats";

// Strava-style run analytics derived from the GPS route: stats, per-km splits,
// and elevation + pace profiles. Pure SVG charts (no chart dependency).
export function RunSummary({
  points,
  distanceKm,
  durationSeconds,
  movingSeconds,
  avgPaceSecondsPerKm,
  elevationGainM,
  avgCadence,
  weightKg,
  calories: caloriesProp,
  copy
}: {
  points: RunRoutePoint[];
  distanceKm: number;
  durationSeconds: number;
  movingSeconds: number;
  avgPaceSecondsPerKm: number | null;
  elevationGainM: number | null;
  avgCadence?: number | null;
  weightKg?: number | null;
  calories?: number | null;
  copy: CoachCopy;
}) {
  const splits = computeSplits(points);
  const elevation = elevationSeries(points);
  const pace = paceSeries(points);
  // Prefer the smoothed gain from the route; fall back to the stored value.
  const elevGain = points.length > 1 ? smoothedElevationGainM(points) : Math.round(elevationGainM ?? 0);
  // Use the stored calories for saved runs; estimate for the live finish screen.
  const calories = caloriesProp ?? estimateCalories(distanceKm, movingSeconds || durationSeconds, weightKg);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={copy.statDistance} value={`${distanceKm.toFixed(2)} km`} big />
        <Stat label={copy.statTime} value={formatDuration(durationSeconds)} big />
        <Stat label={copy.statPace} value={formatPace(avgPaceSecondsPerKm)} big />
        <Stat label={copy.statMovingTime} value={formatDuration(movingSeconds)} />
        <Stat label={copy.statElevation} value={`${elevGain} m`} />
        {avgCadence ? <Stat label={copy.statCadence} value={`${avgCadence} spm`} /> : null}
        {calories ? <Stat label={copy.statCalories} value={`${calories} kcal`} /> : null}
      </div>

      {splits.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{copy.splitsLabel}</h3>
          <SplitsChart splits={splits} copy={copy} />
        </div>
      ) : null}

      {elevation.length > 1 ? (
        <Profile title={copy.profileElevation} series={elevation} mode="area" color="#15803D" unit="m" />
      ) : null}

      {pace.length > 1 ? (
        <Profile
          title={copy.profilePace}
          series={pace}
          mode="line"
          color="#F47A20"
          invert
          format={(v) => formatPace(Math.round(v))}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 font-black text-gray-950 ${big ? "text-2xl" : "text-base"}`}>{value}</p>
    </div>
  );
}

function SplitsChart({ splits, copy }: { splits: ReturnType<typeof computeSplits>; copy: CoachCopy }) {
  const fastestPace = Math.min(...splits.map((s) => s.paceSecondsPerKm));
  const slowestPace = Math.max(...splits.map((s) => s.paceSecondsPerKm));
  const span = Math.max(1, slowestPace - fastestPace);
  return (
    <div className="space-y-1.5">
      {splits.map((s) => {
        // Faster splits get longer bars (40%–100%).
        const width = 40 + 60 * (1 - (s.paceSecondsPerKm - fastestPace) / span);
        const label = s.meters >= 980 ? `${s.index}` : `${(s.meters / 1000).toFixed(1)}`;
        const barColor = s.fastest ? "bg-brand-teal" : s.slowest ? "bg-gray-300" : "bg-brand-teal/60";
        return (
          <div key={s.index} className="flex items-center gap-2 text-xs">
            <span className="w-6 shrink-0 text-end font-bold text-gray-500">{label}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100">
              <div className={`h-full rounded ${barColor}`} style={{ width: `${width}%` }} />
            </div>
            <span className="w-16 shrink-0 text-end font-bold text-gray-900">{formatPace(s.paceSecondsPerKm)}</span>
            <span className="w-10 shrink-0 text-end text-gray-400">{s.elevationGainM > 0 ? `+${s.elevationGainM}` : ""}</span>
          </div>
        );
      })}
      {splits.some((s) => s.fastest) ? (
        <div className="flex gap-4 pt-1 text-[10px] font-semibold text-gray-400">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-brand-teal" />{copy.splitFastest}</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-gray-300" />{copy.splitSlowest}</span>
        </div>
      ) : null}
    </div>
  );
}

function Profile({
  title,
  series,
  mode,
  color,
  unit,
  invert = false,
  format
}: {
  title: string;
  series: SeriesPoint[];
  mode: "area" | "line";
  color: string;
  unit?: string;
  invert?: boolean;
  format?: (v: number) => string;
}) {
  const W = 300;
  const H = 64;
  const pad = 4;
  const xs = series.map((p) => p.distanceKm);
  const ys = series.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const px = (x: number) => pad + ((x - minX) / spanX) * (W - 2 * pad);
  const py = (y: number) => pad + (1 - (y - minY) / spanY) * (H - 2 * pad);

  const line = series.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.distanceKm).toFixed(1)} ${py(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${px(maxX).toFixed(1)} ${H - pad} L${px(minX).toFixed(1)} ${H - pad} Z`;

  const fmt = format ?? ((v: number) => `${Math.round(v)}${unit ? ` ${unit}` : ""}`);
  // For pace, lower is "better" — show fastest (min) and slowest (max).
  const hi = invert ? minY : maxY;
  const lo = invert ? maxY : minY;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-gray-500">
        <span className="uppercase tracking-wide">{title}</span>
        <span className="text-gray-400">{fmt(hi)} · {fmt(lo)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-16 w-full" preserveAspectRatio="none" role="img" aria-label={title}>
        {mode === "area" ? <path d={area} fill={color} opacity={0.15} /> : null}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
