import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { PAGEVIEW_RETENTION_DAYS, rangeToDays, type AnalyticsRange } from "./constants";

// Read model for the admin analytics dashboard. All aggregation happens in
// Postgres ($queryRaw / groupBy) so the pages stay fast even as PageView grows.
// Windows are computed from "now" in the DB/server timezone (UTC in prod).

export type MetricDelta = { current: number; previous: number };
export type AnalyticsOverview = {
  pageViews: MetricDelta;
  visitors: MetricDelta;
  sessions: MetricDelta;
  viewsPerVisitor: MetricDelta;
};

export type TrafficPoint = { day: string; pageViews: number; visitors: number };
export type GrowthPoint = { day: string; signups: number; runs: number; registrations: number };
export type TopPageRow = { path: string; views: number; visitors: number };
export type BreakdownRow = { key: string; count: number };
export type GrowthSummary = {
  signups: MetricDelta;
  runs: MetricDelta;
  registrations: MetricDelta;
  dau: number;
  wau: number;
};

type BreakdownField = "locale" | "device" | "platform" | "browser" | "country" | "referrerHost";

function windowBounds(days: number) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const prevSince = new Date(now.getTime() - 2 * days * 86_400_000);
  return { since, prevSince };
}

/** Headline traffic KPIs for the range, each with its previous-period counterpart. */
export async function getAnalyticsOverview(range: AnalyticsRange): Promise<AnalyticsOverview> {
  const { since, prevSince } = windowBounds(rangeToDays(range));
  const rows = await getPrisma().$queryRaw<
    Array<{
      pv_current: bigint;
      pv_previous: bigint;
      v_current: bigint;
      v_previous: bigint;
      s_current: bigint;
      s_previous: bigint;
    }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE "createdAt" >= ${since}) AS pv_current,
      COUNT(*) FILTER (WHERE "createdAt" >= ${prevSince} AND "createdAt" < ${since}) AS pv_previous,
      COUNT(DISTINCT "visitorId") FILTER (WHERE "createdAt" >= ${since}) AS v_current,
      COUNT(DISTINCT "visitorId") FILTER (WHERE "createdAt" >= ${prevSince} AND "createdAt" < ${since}) AS v_previous,
      COUNT(DISTINCT "sessionId") FILTER (WHERE "createdAt" >= ${since}) AS s_current,
      COUNT(DISTINCT "sessionId") FILTER (WHERE "createdAt" >= ${prevSince} AND "createdAt" < ${since}) AS s_previous
    FROM "PageView"
    WHERE "createdAt" >= ${prevSince}
  `;

  const r = rows[0];
  const pageViews = { current: Number(r?.pv_current ?? 0), previous: Number(r?.pv_previous ?? 0) };
  const visitors = { current: Number(r?.v_current ?? 0), previous: Number(r?.v_previous ?? 0) };
  const sessions = { current: Number(r?.s_current ?? 0), previous: Number(r?.s_previous ?? 0) };
  const viewsPerVisitor = {
    current: ratio(pageViews.current, visitors.current),
    previous: ratio(pageViews.previous, visitors.previous)
  };

  return { pageViews, visitors, sessions, viewsPerVisitor };
}

/** Daily page-view / unique-visitor series, zero-filled across the whole range. */
export async function getTrafficTimeSeries(range: AnalyticsRange): Promise<TrafficPoint[]> {
  const { since } = windowBounds(rangeToDays(range));
  const rows = await getPrisma().$queryRaw<Array<{ day: Date; page_views: bigint; visitors: bigint }>>`
    SELECT
      d::date AS day,
      COUNT(pv."id") AS page_views,
      COUNT(DISTINCT pv."visitorId") AS visitors
    FROM generate_series(${since}::date, CURRENT_DATE, '1 day') AS d
    LEFT JOIN "PageView" pv
      ON pv."createdAt" >= d AND pv."createdAt" < d + INTERVAL '1 day'
    GROUP BY d
    ORDER BY d
  `;
  return rows.map((row) => ({
    day: toDayString(row.day),
    pageViews: Number(row.page_views),
    visitors: Number(row.visitors)
  }));
}

/** Daily signups / runs / registrations from the existing product tables. */
export async function getGrowthTimeSeries(range: AnalyticsRange): Promise<GrowthPoint[]> {
  const { since } = windowBounds(rangeToDays(range));
  const rows = await getPrisma().$queryRaw<Array<{ day: Date; signups: bigint; runs: bigint; registrations: bigint }>>`
    SELECT
      d::date AS day,
      (SELECT COUNT(*) FROM "User" u WHERE u."createdAt" >= d AND u."createdAt" < d + INTERVAL '1 day') AS signups,
      (SELECT COUNT(*) FROM "RunnerRun" r WHERE r."createdAt" >= d AND r."createdAt" < d + INTERVAL '1 day') AS runs,
      (SELECT COUNT(*) FROM "RaceRegistration" rr WHERE rr."createdAt" >= d AND rr."createdAt" < d + INTERVAL '1 day') AS registrations
    FROM generate_series(${since}::date, CURRENT_DATE, '1 day') AS d
    ORDER BY d
  `;
  return rows.map((row) => ({
    day: toDayString(row.day),
    signups: Number(row.signups),
    runs: Number(row.runs),
    registrations: Number(row.registrations)
  }));
}

/** Most-visited normalized routes for the range. */
export async function getTopPages(range: AnalyticsRange, limit = 12): Promise<TopPageRow[]> {
  const { since } = windowBounds(rangeToDays(range));
  const rows = await getPrisma().$queryRaw<Array<{ path: string; views: bigint; visitors: bigint }>>`
    SELECT path, COUNT(*) AS views, COUNT(DISTINCT "visitorId") AS visitors
    FROM "PageView"
    WHERE "createdAt" >= ${since}
    GROUP BY path
    ORDER BY views DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ path: row.path, views: Number(row.views), visitors: Number(row.visitors) }));
}

/**
 * Grouped counts for a single dimension. `field` is a closed compile-time union,
 * so interpolating it as an identifier via Prisma.raw is injection-safe.
 */
async function getBreakdown(field: BreakdownField, range: AnalyticsRange, limit?: number): Promise<BreakdownRow[]> {
  const { since } = windowBounds(rangeToDays(range));
  const column = Prisma.raw(`"${field}"`);
  const limitClause = limit ? Prisma.sql`LIMIT ${limit}` : Prisma.empty;
  const rows = await getPrisma().$queryRaw<Array<{ key: string | null; count: bigint }>>(Prisma.sql`
    SELECT ${column} AS key, COUNT(*) AS count
    FROM "PageView"
    WHERE "createdAt" >= ${since} AND ${column} IS NOT NULL
    GROUP BY ${column}
    ORDER BY count DESC
    ${limitClause}
  `);
  return rows.map((row) => ({ key: row.key ?? "unknown", count: Number(row.count) }));
}

export const getLanguageBreakdown = (range: AnalyticsRange) => getBreakdown("locale", range);
export const getDeviceBreakdown = (range: AnalyticsRange) => getBreakdown("device", range);
export const getPlatformBreakdown = (range: AnalyticsRange) => getBreakdown("platform", range);
export const getBrowserBreakdown = (range: AnalyticsRange) => getBreakdown("browser", range, 6);
export const getCountryBreakdown = (range: AnalyticsRange) => getBreakdown("country", range, 10);
export const getReferrerBreakdown = (range: AnalyticsRange) => getBreakdown("referrerHost", range, 10);

/** Product engagement + growth KPIs, joining tracking with the product tables. */
export async function getGrowthSummary(range: AnalyticsRange): Promise<GrowthSummary> {
  const prisma = getPrisma();
  const days = rangeToDays(range);
  const { since, prevSince } = windowBounds(days);
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [
    signupsCur,
    signupsPrev,
    runsCur,
    runsPrev,
    regsCur,
    regsPrev,
    dauRows,
    wauRows
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.runnerRun.count({ where: { createdAt: { gte: since } } }),
    prisma.runnerRun.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.raceRegistration.count({ where: { createdAt: { gte: since } } }),
    prisma.raceRegistration.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "visitorId") AS count FROM "PageView" WHERE "createdAt" >= ${oneDayAgo}
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "visitorId") AS count FROM "PageView" WHERE "createdAt" >= ${sevenDaysAgo}
    `
  ]);

  return {
    signups: { current: signupsCur, previous: signupsPrev },
    runs: { current: runsCur, previous: runsPrev },
    registrations: { current: regsCur, previous: regsPrev },
    dau: Number(dauRows[0]?.count ?? 0),
    wau: Number(wauRows[0]?.count ?? 0)
  };
}

/** Delete page-view rows older than the retention window. Used by the prune script. */
export async function prunePageViews(retentionDays: number = PAGEVIEW_RETENTION_DAYS) {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const result = await getPrisma().pageView.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deleted: result.count, cutoff, retentionDays };
}

export type SearchRow = { term: string; searches: number; lastResultCount: number };
export type FunnelStage = { key: string; label: string; count: number };

/** Most-run search terms in the range. */
export async function getTopSearches(range: AnalyticsRange, limit = 10): Promise<SearchRow[]> {
  const { since } = windowBounds(rangeToDays(range));
  const rows = await getPrisma().$queryRaw<Array<{ term: string; searches: bigint; last_result: number }>>`
    SELECT term, COUNT(*) AS searches, (ARRAY_AGG("resultCount" ORDER BY "createdAt" DESC))[1] AS last_result
    FROM "SearchQuery"
    WHERE "createdAt" >= ${since}
    GROUP BY term
    ORDER BY searches DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ term: row.term, searches: Number(row.searches), lastResultCount: Number(row.last_result) }));
}

/** Searches that returned nothing — the "what to add" to-do list. */
export async function getZeroResultSearches(range: AnalyticsRange, limit = 10): Promise<SearchRow[]> {
  const { since } = windowBounds(rangeToDays(range));
  const rows = await getPrisma().$queryRaw<Array<{ term: string; searches: bigint }>>`
    SELECT term, COUNT(*) AS searches
    FROM "SearchQuery"
    WHERE "createdAt" >= ${since} AND "resultCount" = 0
    GROUP BY term
    ORDER BY searches DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ term: row.term, searches: Number(row.searches), lastResultCount: 0 }));
}

/**
 * Registration funnel from PageView path stages + the registrations table. The last
 * stage counts RaceRegistration rows (registration is a server action, and its
 * success redirect drops the querystring, so it isn't visible from paths alone) —
 * an honest directional funnel rather than a strict per-visitor one.
 */
export async function getRegistrationFunnel(range: AnalyticsRange): Promise<FunnelStage[]> {
  const prisma = getPrisma();
  const { since } = windowBounds(rangeToDays(range));
  const rows = await prisma.$queryRaw<Array<{ listing: bigint; browsed: bigint; started: bigint }>>`
    SELECT
      COUNT(DISTINCT "visitorId") FILTER (WHERE path = '/races') AS listing,
      COUNT(DISTINCT "visitorId") FILTER (WHERE path = '/races/[id]') AS browsed,
      COUNT(DISTINCT "visitorId") FILTER (WHERE path = '/races/[id]/register') AS started
    FROM "PageView"
    WHERE "createdAt" >= ${since}
  `;
  const completed = await prisma.raceRegistration.count({ where: { createdAt: { gte: since } } });
  const s = rows[0];
  return [
    { key: "listing", label: "Browsed races", count: Number(s?.listing ?? 0) },
    { key: "browsed", label: "Viewed a race", count: Number(s?.browsed ?? 0) },
    { key: "started", label: "Started registration", count: Number(s?.started ?? 0) },
    { key: "completed", label: "Completed registration", count: completed }
  ];
}

/** Delete search-log rows older than the retention window. */
export async function pruneSearchQueries(retentionDays: number = PAGEVIEW_RETENTION_DAYS) {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const result = await getPrisma().searchQuery.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deleted: result.count, cutoff, retentionDays };
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10) / 10;
}

function toDayString(day: Date): string {
  // day arrives as a JS Date at UTC midnight; format as YYYY-MM-DD without tz drift.
  return day.toISOString().slice(0, 10);
}
