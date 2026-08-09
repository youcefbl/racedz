import { z } from "zod";
import { apiOk, withApi } from "@/lib/api/v1/http";
import { optionalMobileUser } from "@/lib/api/v1/guard";
import { getPrisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { clientIp, enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { normalizePath } from "@/lib/analytics/enrich";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  path: z.string().min(1).max(2048),
  locale: z.string().max(8).optional(),
  /** Random per-install id, minted on the device. The mobile equivalent of the visitor cookie. */
  visitorId: z.string().uuid(),
  /** Random id for one run of use, rotated by the client after 30 minutes idle. */
  sessionId: z.string().uuid(),
});

/**
 * Screen-view beacon for the native app — the mobile twin of /api/track.
 *
 * It needs its own route rather than reusing that one, for a reason worth stating: /api/track
 * identifies a visitor by first-party COOKIE. A native client has no cookie jar, so every beacon
 * would have minted a fresh visitorId and each screen view would have counted as a brand-new
 * unique visitor — the admin dashboard would not have gained native traffic, it would have been
 * corrupted by it. The device supplies the two ids instead, with the same lifetimes the cookies
 * have (a stable per-install id, a 30-minute rolling session).
 *
 * Neither id is a device identifier: both are random UUIDs the app generates and can clear, never
 * ANDROID_ID or anything else that survives a reinstall or identifies the hardware.
 *
 * Attribution to a signed-in runner is best-effort and never required — the app tracks before
 * sign-in too, and an expired token must degrade to anonymous rather than dropping the view.
 */
export const POST = withApi(async (request) => {
  const ip = clientIp(request.headers) ?? "unknown";
  const limited = enforceRateLimit(rateLimitKey("v1-track", ip), 300, 60_000);
  // Deliberately a silent accept rather than a 429: analytics must never surface an error to the
  // runner, and a client that retried a rate-limited beacon would only make it worse.
  if (limited) return apiOk(request, { recorded: false });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Field names only — never the body, which carries the path the runner was looking at. A
    // beacon dropped in silence is undiagnosable, and a client sending a slightly wrong shape
    // would otherwise look exactly like a client sending nothing.
    console.warn("[v1/track] rejected fields:", Object.keys(parsed.error.flatten().fieldErrors).join(", "));
    return apiOk(request, { recorded: false });
  }

  const path = normalizePath(parsed.data.path);
  const viewer = await optionalMobileUser(request);

  try {
    await getPrisma().pageView.create({
      data: {
        visitorId: parsed.data.visitorId,
        sessionId: parsed.data.sessionId,
        userId: viewer?.id ?? null,
        path,
        referrerHost: null,
        locale: parsed.data.locale ? getLocale(parsed.data.locale) : null,
        // The app is one "device"; there is no user-agent to parse and inventing one would put
        // fiction in the dashboard's device breakdown.
        device: "mobile",
        platform: "android",
        browser: null,
        country: null,
      },
    });
  } catch (error) {
    // Never break the client over a tracking write.
    console.error("[v1/track] failed to record screen view", error);
  }

  return apiOk(request, { recorded: true });
});
