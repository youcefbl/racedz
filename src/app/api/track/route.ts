import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { clientIp, enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getLocale } from "@/lib/i18n";
import {
  isBotUserAgent,
  normalizePath,
  parseBrowser,
  parseDevice,
  parseReferrerHost
} from "@/lib/analytics/enrich";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE
} from "@/lib/analytics/constants";

// Public, unauthenticated page-view beacon. Called by the client tracker on every
// route change via navigator.sendBeacon. Deliberately lightweight and fail-soft:
// tracking must never surface an error to the user, so we always answer 204.
export const runtime = "nodejs";

const bodySchema = z.object({
  path: z.string().min(1).max(2048),
  locale: z.string().max(8).optional(),
  referrer: z.string().max(2048).optional(),
  platform: z.enum(["web", "android"]).optional()
});

const noContent = (cookies?: Array<{ name: string; value: string; maxAge: number }>) => {
  const response = new NextResponse(null, { status: 204 });
  const secure = process.env.NODE_ENV === "production";
  for (const cookie of cookies ?? []) {
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: cookie.maxAge
    });
  }
  return response;
};

export async function POST(request: NextRequest) {
  // Abuse guard — generous, since one human page view = one beacon.
  const ip = clientIp(request.headers) ?? "unknown";
  const limited = enforceRateLimit(rateLimitKey("track", ip), 300, 60_000);
  if (limited) return limited;

  const userAgent = request.headers.get("user-agent") ?? "";

  // Parse the beacon payload (sendBeacon may send text/plain, so read raw text).
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(JSON.parse(await request.text()));
  } catch {
    return noContent();
  }

  const path = normalizePath(parsed.path);

  // Refresh (or mint) the opaque visitor/session cookies regardless of whether we
  // ultimately record the row, so counts stay consistent across a session.
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value || randomUUID();
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || randomUUID();
  const refreshedCookies = [
    { name: VISITOR_COOKIE, value: visitorId, maxAge: VISITOR_COOKIE_MAX_AGE },
    { name: SESSION_COOKIE, value: sessionId, maxAge: SESSION_COOKIE_MAX_AGE }
  ];

  // Drop bot traffic and internal/admin/api noise — accepted but not recorded.
  if (isBotUserAgent(userAgent) || path.startsWith("/admin") || path.startsWith("/api")) {
    return noContent(refreshedCookies);
  }

  const selfHost = request.headers.get("host");
  const country = normalizeCountry(request.headers.get("cf-ipcountry"));

  // Best-effort logged-in user attribution; never block tracking on it.
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.user?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    await getPrisma().pageView.create({
      data: {
        visitorId,
        sessionId,
        userId,
        path,
        referrerHost: parseReferrerHost(parsed.referrer, selfHost),
        locale: parsed.locale ? getLocale(parsed.locale) : null,
        device: parseDevice(userAgent),
        platform: parsed.platform ?? "web",
        browser: parseBrowser(userAgent),
        country
      }
    });
  } catch (error) {
    // Never break the client over a tracking write.
    console.error("[track] failed to record page view", error);
  }

  return noContent(refreshedCookies);
}

function normalizeCountry(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim().toUpperCase();
  // Cloudflare uses "XX"/"T1" for unknown/Tor — treat as no signal.
  if (!/^[A-Z]{2}$/.test(value) || value === "XX" || value === "T1") return null;
  return value;
}
