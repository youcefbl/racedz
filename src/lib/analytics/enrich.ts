// Server-side enrichment helpers for the page-view tracker (src/app/api/track).
// Kept dependency-free: a tiny UA parser and a path normalizer so we never store
// high-cardinality raw URLs or ship a heavyweight UA library.

export type DeviceType = "mobile" | "tablet" | "desktop";
export type PlatformType = "web" | "android";

/**
 * Collapse id-like path segments to "[id]" so "/races/clx123..." and
 * "/races/cly456..." both bucket under "/races/[id]". Keeps the PageView.path
 * cardinality bounded and the Top Pages report meaningful.
 */
export function normalizePath(rawPath: string): string {
  let pathname = rawPath.split("?")[0].split("#")[0].trim();
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  // Drop trailing slash (except root).
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");

  const segments = pathname.split("/").filter(Boolean).slice(0, 8);
  const normalized = segments.map((segment) => (isIdLike(segment) ? "[id]" : segment.toLowerCase()));

  return normalized.length ? `/${normalized.join("/")}` : "/";
}

function isIdLike(segment: string): boolean {
  // Pure numeric id.
  if (/^\d+$/.test(segment)) return true;
  // UUID.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
  // Prisma cuid (starts with "c", ~25 lowercase alnum chars).
  if (/^c[a-z0-9]{20,}$/i.test(segment)) return true;
  // Long hex/opaque token.
  if (/^[0-9a-f]{24,}$/i.test(segment)) return true;
  return false;
}

/** Coarse device class from the User-Agent string. */
export function parseDevice(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))|kindle|silk|playbook/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/.test(ua)) return "mobile";
  return "desktop";
}

/** Coarse browser family from the User-Agent string. */
export function parseBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/edg\//.test(ua)) return "Edge";
  if (/opr\/|opera/.test(ua)) return "Opera";
  if (/samsungbrowser/.test(ua)) return "Samsung Internet";
  if (/firefox|fxios/.test(ua)) return "Firefox";
  // Chrome must be checked before Safari (Chrome UA also contains "safari").
  if (/chrome|crios|chromium/.test(ua)) return "Chrome";
  if (/safari/.test(ua)) return "Safari";
  return "Other";
}

/**
 * Best-effort bot detection so crawlers, previews, and synthetic checks don't
 * pollute human-traffic metrics. Conservative — only well-known signatures.
 */
export function isBotUserAgent(userAgent: string): boolean {
  if (!userAgent) return true; // empty UA is almost always a script/bot
  return /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|bingpreview|headless|lighthouse|pingdom|uptimerobot|curl|wget|python-requests|axios\/|node-fetch/i.test(
    userAgent
  );
}

/** Extract the bare host from a referrer URL; null for same-origin, empty, or unparseable. */
export function parseReferrerHost(referrer: string | undefined | null, selfHost: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;
    if (selfHost && host === selfHost.toLowerCase().replace(/^www\./, "")) return null; // internal navigation
    return host.slice(0, 120);
  } catch {
    return null;
  }
}
