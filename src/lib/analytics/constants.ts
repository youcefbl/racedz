// Shared constants for the first-party analytics module.

/** How long raw PageView rows are kept before pruning (see scripts/prune-pageviews.ts). */
export const PAGEVIEW_RETENTION_DAYS = 90;

/** Opaque first-party cookies. Not PII — random ids scoped to zidrun.com. */
export const VISITOR_COOKIE = "zr_vid";
export const SESSION_COOKIE = "zr_sid";

/** Stable ~1-year visitor cookie; 30-minute rolling session cookie. */
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year (seconds)
export const SESSION_COOKIE_MAX_AGE = 60 * 30; // 30 minutes (seconds)

/** Dashboard time ranges. */
export const ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const DEFAULT_RANGE: AnalyticsRange = "30d";

export function resolveRange(value?: string | string[] | null): AnalyticsRange {
  const raw = Array.isArray(value) ? value[0] : value;
  return (ANALYTICS_RANGES as readonly string[]).includes(raw ?? "") ? (raw as AnalyticsRange) : DEFAULT_RANGE;
}

export function rangeToDays(range: AnalyticsRange): number {
  return range === "7d" ? 7 : range === "90d" ? 90 : 30;
}
