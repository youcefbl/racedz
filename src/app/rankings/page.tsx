import { Gauge, Medal, Route as RouteIcon, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { FollowButton } from "@/components/social/follow-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { getPrisma } from "@/lib/db";
import { getDictionary, getLocale, withLocale, type Locale } from "@/lib/i18n";
import { getWilayaLeaderboards, type LeaderboardEntry } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

type RankingsPageProps = {
  searchParams?: Promise<{ lang?: Locale; wilaya?: string; window?: string }>;
};

export default async function RankingsPage({ searchParams }: RankingsPageProps) {
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const dictionary = getDictionary(locale);
  const content = dictionary.pages.rankings;
  const rtl = locale === "ar";

  const wilaya = params?.wilaya && (ALGERIA_WILAYAS as readonly string[]).includes(params.wilaya) ? params.wilaya : "";
  const monthly = params?.window === "month";
  const { pace, distance } = await getWilayaLeaderboards({ wilaya, monthly });

  // Let logged-in runners follow people straight from the board. Resolve who the viewer already
  // follows among the ranked runners in one query so each row renders the right button state.
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  let followingIds = new Set<string>();
  if (viewerId) {
    const rankedIds = [...new Set([...pace, ...distance].map((entry) => entry.userId))];
    const rows = await getPrisma().follow.findMany({
      where: { followerId: viewerId, followingId: { in: rankedIds } },
      select: { followingId: true }
    });
    followingIds = new Set(rows.map((row) => row.followingId));
  }

  const tabHref = (window: "all" | "month") =>
    withLocale(`/rankings?${new URLSearchParams({ ...(wilaya ? { wilaya } : {}), ...(window === "month" ? { window: "month" } : {}) }).toString()}`, locale);

  return (
    <div className="bg-gray-50" dir={rtl ? "rtl" : "ltr"}>
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-orange">
            <Trophy className="size-4" aria-hidden="true" />
            {content.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black text-gray-950 sm:text-4xl">{content.title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">{content.intro}</p>

          {/* Filters */}
          <form action={withLocale("/rankings", locale)} className="mt-6 flex flex-wrap items-end gap-3">
            {locale !== "en" ? <input type="hidden" name="lang" value={locale} /> : null}
            {monthly ? <input type="hidden" name="window" value="month" /> : null}
            <label className="grid gap-1 text-xs font-bold text-gray-700">
              {content.wilayaLabel}
              <select name="wilaya" defaultValue={wilaya} className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100">
                <option value="">{content.allWilayas}</option>
                {ALGERIA_WILAYAS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary" size="md">
              {content.filter}
            </Button>
            <span className="grow" />
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <TabLink href={tabHref("all")} active={!monthly}>{content.allTime}</TabLink>
              <TabLink href={tabHref("month")} active={monthly}>{content.thisMonth}</TabLink>
            </div>
          </form>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Board title={content.bestPace} icon={Gauge} entries={pace} metric="pace" emptyText={content.empty} locale={locale} viewerId={viewerId} followingIds={followingIds} />
        <Board title={content.longestDistance} icon={RouteIcon} entries={distance} metric="distance" emptyText={content.empty} locale={locale} viewerId={viewerId} followingIds={followingIds} />
      </section>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 ${active ? "bg-brand-teal text-white" : "text-gray-600 hover:bg-gray-100"}`}
    >
      {children}
    </a>
  );
}

function Board({
  title,
  icon: Icon,
  entries,
  metric,
  emptyText,
  locale,
  viewerId,
  followingIds
}: {
  title: string;
  icon: typeof Gauge;
  entries: LeaderboardEntry[];
  metric: "pace" | "distance";
  emptyText: string;
  locale: Locale;
  viewerId: string | null;
  followingIds: Set<string>;
}) {
  const coachLocale = locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en";
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
        <Icon className="size-5 text-brand-teal" aria-hidden="true" />
        <h2 className="text-lg font-black text-gray-950">{title}</h2>
      </div>
      {entries.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={emptyText}
          className="rounded-none border-0 shadow-none"
        />
      ) : (
        <ol className="divide-y divide-gray-100">
          {entries.map((entry, index) => (
            <li key={entry.userId} className="flex items-center gap-3 px-4 py-3">
              <span className="flex w-7 shrink-0 justify-center text-sm font-black tabular-nums text-gray-400">
                {index < 3 ? <Medal className={`size-5 ${medalColor(index)}`} aria-hidden="true" /> : index + 1}
              </span>
              <Avatar name={entry.name} url={entry.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-gray-950">{entry.name.trim() || "Runner"}</p>
                <p className="truncate text-xs font-semibold text-gray-500">
                  {entry.wilaya ?? "—"} · {formatDate(entry.startedAt, locale)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-black tabular-nums text-brand-teal">
                {metric === "pace" ? formatPace(entry.paceSecondsPerKm) : `${entry.distanceKm.toFixed(1)} km`}
              </span>
              {viewerId && entry.userId !== viewerId ? (
                <FollowButton userId={entry.userId} initialFollowing={followingIds.has(entry.userId)} locale={coachLocale} />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" decoding="async" className="size-9 shrink-0 rounded-full object-cover" />;
  }
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-black text-brand-teal">
      {initials || "R"}
    </span>
  );
}

function medalColor(index: number) {
  return ["text-amber-400", "text-gray-400", "text-orange-400"][index] ?? "text-gray-400";
}

function formatPace(secondsPerKm: number) {
  if (!secondsPerKm || secondsPerKm <= 0) return "—";
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

function formatDate(value: Date, locale: Locale) {
  return new Date(value).toLocaleDateString(locale === "ar" ? "ar" : locale, { year: "numeric", month: "short", day: "numeric" });
}
