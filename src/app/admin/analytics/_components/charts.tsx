import type { ComponentType } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetricDelta, TrafficPoint } from "@/lib/analytics";

// Self-contained, dependency-free presentational primitives for the analytics
// dashboard: KPI cards with period-over-period deltas, an SVG traffic chart, a
// ranked bar list, and a proportion breakdown. Light-theme (admin chrome is fixed
// light), brand teal/orange plus an accessible categorical palette for splits.

// Categorical palette — distinguishable hues at a consistent weight (~600).
export const CATEGORY_COLORS = ["#0d9488", "#ea580c", "#2563eb", "#7c3aed", "#16a34a", "#db2777", "#64748b"];

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

type DeltaTone = "up" | "down" | "flat";

function getDelta(delta: MetricDelta): { label: string; tone: DeltaTone } {
  const { current, previous } = delta;
  if (previous === 0) {
    return current > 0 ? { label: "New", tone: "up" } : { label: "0%", tone: "flat" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: "0%", tone: "flat" };
  return { label: `${pct > 0 ? "+" : ""}${pct}%`, tone: pct > 0 ? "up" : "down" };
}

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "teal",
  hint
}: {
  label: string;
  value: string | number;
  delta?: MetricDelta;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: "teal" | "orange";
  hint?: string;
}) {
  const info = delta ? getDelta(delta) : null;
  const DeltaIcon = info?.tone === "up" ? TrendingUp : info?.tone === "down" ? TrendingDown : Minus;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-lg",
            tone === "orange" ? "bg-orange-50 text-brand-orange" : "bg-teal-50 text-brand-teal"
          )}
        >
          <Icon className="size-5" aria-hidden={true} />
        </div>
        {info ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
              info.tone === "up" && "bg-green-50 text-green-700",
              info.tone === "down" && "bg-red-50 text-red-700",
              info.tone === "flat" && "bg-gray-100 text-gray-500"
            )}
          >
            <DeltaIcon className="size-3.5" aria-hidden={true} />
            {info.label}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-gray-950">{typeof value === "number" ? formatNumber(value) : value}</p>
      <p className="mt-1 text-xs font-semibold text-gray-400">{hint ?? (delta ? "vs previous period" : " ")}</p>
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
  right
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-gray-950">{title}</h2>
          {description ? <p className="mt-0.5 text-xs font-semibold text-gray-400">{description}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Two-series area+line traffic chart rendered as inline SVG (no chart lib). */
export function TrafficChart({ points }: { points: TrafficPoint[] }) {
  const width = 760;
  const height = 240;
  const padX = 6;
  const padTop = 18;
  const padBottom = 24;
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.pageViews));

  const xAt = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * (width - 2 * padX));
  const yAt = (v: number) => padTop + (1 - v / max) * (height - padTop - padBottom);

  const pvLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.pageViews).toFixed(1)}`).join(" ");
  const pvArea = `${pvLine} L${xAt(n - 1).toFixed(1)},${(height - padBottom).toFixed(1)} L${xAt(0).toFixed(1)},${(height - padBottom).toFixed(1)} Z`;
  const visLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.visitors).toFixed(1)}`).join(" ");

  const first = points[0]?.day;
  const last = points[n - 1]?.day;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-gray-600">
          <span className="size-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[0] }} /> Page views
        </span>
        <span className="flex items-center gap-1.5 text-gray-600">
          <span className="size-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[1] }} /> Unique visitors
        </span>
        <span className="ml-auto text-gray-400">Peak {formatNumber(max)} / day</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Traffic over time" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CATEGORY_COLORS[0]} stopOpacity="0.22" />
            <stop offset="100%" stopColor={CATEGORY_COLORS[0]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <line x1={padX} y1={height - padBottom} x2={width - padX} y2={height - padBottom} stroke="#e5e7eb" strokeWidth="1" />
        {n > 0 ? (
          <>
            <path d={pvArea} fill="url(#pvFill)" />
            <path d={pvLine} fill="none" stroke={CATEGORY_COLORS[0]} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={visLine} fill="none" stroke={CATEGORY_COLORS[1]} strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>
      <div className="mt-1 flex justify-between text-xs font-semibold text-gray-400">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

/** Ranked horizontal bars with the value drawn as a tinted track behind the label. */
export function BarList({ items, emptyLabel = "No data yet" }: { items: Array<{ label: string; value: number; sub?: string }>; emptyLabel?: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm font-semibold text-gray-400">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="relative overflow-hidden rounded-md">
          <div className="absolute inset-y-0 left-0 rounded-md bg-teal-50" style={{ width: `${(item.value / max) * 100}%` }} aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0 truncate text-sm font-semibold text-gray-800" title={item.label}>
              {item.label}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-sm font-bold tabular-nums text-gray-900">
              {item.sub ? <span className="text-xs font-semibold text-gray-400">{item.sub}</span> : null}
              {formatNumber(item.value)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Funnel: decreasing bars with per-step conversion %. */
export function FunnelChart({ stages }: { stages: Array<{ key: string; label: string; count: number }> }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ul className="space-y-3">
      {stages.map((stage, index) => {
        const prev = index > 0 ? stages[index - 1].count : null;
        const stepPct = prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
        return (
          <li key={stage.key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-700">{stage.label}</span>
              <span className="font-bold tabular-nums text-gray-900">
                {formatNumber(stage.count)}
                {stepPct != null ? <span className="ml-2 text-xs font-semibold text-gray-400">{stepPct}% of prev</span> : null}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${(stage.count / max) * 100}%`, background: CATEGORY_COLORS[0] }} aria-hidden="true" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Stacked proportion bar + legend with percentages, for categorical splits. */
export function ProportionList({ items, emptyLabel = "No data yet" }: { items: Array<{ label: string; value: number }>; emptyLabel?: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm font-semibold text-gray-400">{emptyLabel}</p>;
  }
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        {items.map((item, index) => (
          <div
            key={item.label}
            style={{ width: `${(item.value / total) * 100}%`, background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
            aria-hidden="true"
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
              <span className="truncate font-semibold text-gray-700">{item.label}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums text-gray-900">
              {formatNumber(item.value)}
              <span className="ml-1.5 text-xs font-semibold text-gray-400">{Math.round((item.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
