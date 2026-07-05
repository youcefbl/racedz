import Link from "next/link";
import {
  Activity,
  ClipboardList,
  Eye,
  Filter,
  Footprints,
  Globe2,
  Languages,
  Link2,
  MonitorSmartphone,
  MousePointerClick,
  Radio,
  Search,
  SearchX,
  UserPlus,
  Users
} from "lucide-react";
import { LOCALE_NAMES, type Locale } from "@/lib/i18n";
import { requireAdmin } from "@/lib/admin";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_RANGES,
  getAnalyticsOverview,
  getBrowserBreakdown,
  getCountryBreakdown,
  getDeviceBreakdown,
  getGrowthSummary,
  getGrowthTimeSeries,
  getLanguageBreakdown,
  getPlatformBreakdown,
  getReferrerBreakdown,
  getRegistrationFunnel,
  getTopPages,
  getTopSearches,
  getTrafficTimeSeries,
  getZeroResultSearches,
  rangeToDays,
  resolveRange,
  type AnalyticsRange
} from "@/lib/analytics";
import { AdminShell } from "../_components/admin-ui";
import { BarList, ChartCard, FunnelChart, MetricCard, ProportionList, TrafficChart } from "./_components/charts";

export const dynamic = "force-dynamic";

const RANGE_LABELS: Record<AnalyticsRange, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };

type AnalyticsPageProps = {
  searchParams?: Promise<{ range?: string }>;
};

export default async function AdminAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const range = resolveRange(params?.range);

  const [
    overview,
    traffic,
    growthSeries,
    growth,
    topPages,
    languages,
    devices,
    platforms,
    browsers,
    referrers,
    countries,
    funnel,
    topSearches,
    zeroResultSearches
  ] = await Promise.all([
    getAnalyticsOverview(range),
    getTrafficTimeSeries(range),
    getGrowthTimeSeries(range),
    getGrowthSummary(range),
    getTopPages(range),
    getLanguageBreakdown(range),
    getDeviceBreakdown(range),
    getPlatformBreakdown(range),
    getBrowserBreakdown(range),
    getReferrerBreakdown(range),
    getCountryBreakdown(range),
    getRegistrationFunnel(range),
    getTopSearches(range),
    getZeroResultSearches(range)
  ]);

  const days = rangeToDays(range);
  const hasTraffic = overview.pageViews.current + overview.pageViews.previous > 0;

  return (
    <AdminShell
      title="Analytics"
      description={`Visitor traffic, engagement, and audience for the last ${days} days. Metrics compare against the prior ${days}-day period.`}
      action={<RangeTabs current={range} />}
    >
      {!hasTraffic ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          <Radio className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Tracking is live. Page views are recorded first-party (no third-party analytics, no raw IPs). This page fills in as
            visitors browse the site — check back once traffic comes in.
          </span>
        </div>
      ) : null}

      {/* Traffic KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Unique visitors" value={overview.visitors.current} delta={overview.visitors} icon={Users} />
        <MetricCard label="Page views" value={overview.pageViews.current} delta={overview.pageViews} icon={Eye} />
        <MetricCard label="Sessions" value={overview.sessions.current} delta={overview.sessions} icon={MousePointerClick} />
        <MetricCard
          label="Views / visitor"
          value={overview.viewsPerVisitor.current.toFixed(1)}
          delta={overview.viewsPerVisitor}
          icon={Activity}
          tone="orange"
        />
      </section>

      {/* Traffic trend */}
      <div className="mt-6">
        <ChartCard title="Traffic over time" description="Daily page views and unique visitors">
          <TrafficChart points={traffic} />
        </ChartCard>
      </div>

      {/* Engagement & growth */}
      <h2 className="mb-3 mt-8 text-lg font-black text-gray-950">Engagement &amp; growth</h2>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="New signups" value={growth.signups.current} delta={growth.signups} icon={UserPlus} />
        <MetricCard label="Runs logged" value={growth.runs.current} delta={growth.runs} icon={Footprints} />
        <MetricCard label="Race registrations" value={growth.registrations.current} delta={growth.registrations} icon={ClipboardList} />
        <MetricCard
          label="Active visitors"
          value={`${growth.dau} / ${growth.wau}`}
          icon={Activity}
          tone="orange"
          hint="Daily / weekly (unique)"
        />
      </section>
      <div className="mt-4">
        <ChartCard title="Product activity" description="Daily signups, runs logged, and registrations">
          <GrowthChart points={growthSeries} />
        </ChartCard>
      </div>

      {/* Audience */}
      <h2 className="mb-3 mt-8 text-lg font-black text-gray-950">Audience</h2>
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Language" description="Selected interface language" right={<Languages className="size-4 text-gray-300" aria-hidden="true" />}>
          <ProportionList items={languages.map((row) => ({ label: localeLabel(row.key), value: row.count }))} />
        </ChartCard>
        <ChartCard title="Platform" description="Web vs native app" right={<MonitorSmartphone className="size-4 text-gray-300" aria-hidden="true" />}>
          <ProportionList items={platforms.map((row) => ({ label: platformLabel(row.key), value: row.count }))} />
        </ChartCard>
        <ChartCard title="Device" description="Screen class" right={<MonitorSmartphone className="size-4 text-gray-300" aria-hidden="true" />}>
          <ProportionList items={devices.map((row) => ({ label: capitalize(row.key), value: row.count }))} />
        </ChartCard>
      </section>

      {/* Acquisition */}
      <h2 className="mb-3 mt-8 text-lg font-black text-gray-950">Acquisition</h2>
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top pages" description="Most visited routes" right={<Eye className="size-4 text-gray-300" aria-hidden="true" />}>
          <BarList items={topPages.map((row) => ({ label: row.path, value: row.views, sub: `${row.visitors} v` }))} />
        </ChartCard>
        <ChartCard title="Referrers" description="External traffic sources" right={<Link2 className="size-4 text-gray-300" aria-hidden="true" />}>
          <BarList items={referrers.map((row) => ({ label: row.key, value: row.count }))} emptyLabel="No external referrers yet" />
        </ChartCard>
        <ChartCard title="Countries" description="By Cloudflare geo" right={<Globe2 className="size-4 text-gray-300" aria-hidden="true" />}>
          <BarList items={countries.map((row) => ({ label: countryLabel(row.key), value: row.count }))} />
        </ChartCard>
        <ChartCard title="Browsers" description="Rendering engine family" right={<MonitorSmartphone className="size-4 text-gray-300" aria-hidden="true" />}>
          <BarList items={browsers.map((row) => ({ label: row.key, value: row.count }))} />
        </ChartCard>
      </section>

      {/* Conversion funnel */}
      <h2 className="mb-3 mt-8 text-lg font-black text-gray-950">Conversion funnel</h2>
      <ChartCard
        title="Browse → register"
        description="Distinct visitors per stage; the final step counts completed registrations"
        right={<Filter className="size-4 text-gray-300" aria-hidden="true" />}
      >
        <FunnelChart stages={funnel} />
      </ChartCard>

      {/* Search insights */}
      <h2 className="mb-3 mt-8 text-lg font-black text-gray-950">Search insights</h2>
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Zero-result searches"
          description="What people looked for and found nothing — your to-do list"
          right={<SearchX className="size-4 text-gray-300" aria-hidden="true" />}
        >
          <BarList
            items={zeroResultSearches.map((row) => ({ label: row.term, value: row.searches }))}
            emptyLabel="No empty searches yet"
          />
        </ChartCard>
        <ChartCard title="Top searches" description="Most searched terms" right={<Search className="size-4 text-gray-300" aria-hidden="true" />}>
          <BarList
            items={topSearches.map((row) => ({ label: row.term, value: row.searches, sub: row.lastResultCount === 0 ? "0 results" : `${row.lastResultCount} results` }))}
            emptyLabel="No searches yet"
          />
        </ChartCard>
      </section>
    </AdminShell>
  );
}

function RangeTabs({ current }: { current: AnalyticsRange }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      {ANALYTICS_RANGES.map((range) => (
        <Link
          key={range}
          href={`/admin/analytics?range=${range}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
            range === current ? "bg-brand-teal text-white" : "text-gray-500 hover:text-gray-900"
          )}
        >
          {RANGE_LABELS[range]}
        </Link>
      ))}
    </div>
  );
}

// Small multi-series bar chart for daily product activity, inline SVG.
function GrowthChart({ points }: { points: Array<{ day: string; signups: number; runs: number; registrations: number }> }) {
  const series = [
    { key: "signups" as const, label: "Signups", color: "#0d9488" },
    { key: "runs" as const, label: "Runs", color: "#ea580c" },
    { key: "registrations" as const, label: "Registrations", color: "#2563eb" }
  ];
  const width = 760;
  const height = 200;
  const padX = 6;
  const padTop = 12;
  const padBottom = 22;
  const n = points.length;
  const max = Math.max(1, ...points.flatMap((p) => [p.signups, p.runs, p.registrations]));
  const slot = n > 0 ? (width - 2 * padX) / n : 0;
  const groupW = slot * 0.7;
  const barW = groupW / series.length;
  const yAt = (v: number) => padTop + (1 - v / max) * (height - padTop - padBottom);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-600">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <span className="ml-auto text-gray-400">Peak {max} / day</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Product activity over time" preserveAspectRatio="none">
        <line x1={padX} y1={height - padBottom} x2={width - padX} y2={height - padBottom} stroke="#e5e7eb" strokeWidth="1" />
        {points.map((point, i) => {
          const groupX = padX + i * slot + (slot - groupW) / 2;
          return series.map((s, si) => {
            const value = point[s.key];
            const barH = value > 0 ? Math.max(1, height - padBottom - yAt(value)) : 0;
            return (
              <rect
                key={`${i}-${s.key}`}
                x={groupX + si * barW}
                y={height - padBottom - barH}
                width={Math.max(0.5, barW - 0.5)}
                height={barH}
                fill={s.color}
                rx="0.5"
              />
            );
          });
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs font-semibold text-gray-400">
        <span>{points[0]?.day}</span>
        <span>{points[n - 1]?.day}</span>
      </div>
    </div>
  );
}

function localeLabel(code: string): string {
  return LOCALE_NAMES[code as Locale] ?? code;
}

function platformLabel(code: string): string {
  if (code === "android") return "Android app";
  if (code === "web") return "Web";
  return capitalize(code);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

let regionNames: Intl.DisplayNames | null = null;
function countryLabel(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    regionNames = regionNames ?? new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
