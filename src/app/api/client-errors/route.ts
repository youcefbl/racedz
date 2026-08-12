import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { clientIp, enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { BEACON_MAX_BODY_BYTES, readBoundedJson } from "@/lib/http/body";

// Public, unauthenticated crash beacon. Called by client error boundaries via
// navigator.sendBeacon/fetch. Deliberately fail-soft: reporting a crash must never itself
// surface an error, so we always answer 204 regardless of what happens after parsing.
export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  digest: z.string().max(200).optional(),
  route: z.string().min(1).max(2048),
  boundary: z.string().max(200).optional(),
  platform: z.enum(["web", "android"]).optional(),
  // Safe, non-PII breadcrumbs (run status, point count, step index, ...) — primitives only, so
  // there's no way to smuggle nested route/coordinate data through this field.
  context: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  // Abuse guard — generous, but a crash loop shouldn't be able to write unbounded rows.
  const ip = clientIp(request.headers) ?? "unknown";
  const limited = enforceRateLimit(rateLimitKey("client-errors", ip), 60, 60_000);
  if (limited) return limited;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await readBoundedJson(request, BEACON_MAX_BODY_BYTES));
  } catch {
    return noContent();
  }

  // Best-effort logged-in user attribution; never block on it.
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.user?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    await getPrisma().clientErrorLog.create({
      data: {
        userId,
        message: parsed.message,
        stack: parsed.stack,
        digest: parsed.digest,
        route: parsed.route,
        boundary: parsed.boundary,
        platform: parsed.platform,
        userAgent: request.headers.get("user-agent"),
        // Cap the serialized size defensively — this is typed to primitives only, but a caller
        // could still stuff in enough keys/strings to bloat a row.
        context: parsed.context && JSON.stringify(parsed.context).length <= 4000 ? parsed.context : undefined
      }
    });
  } catch (error) {
    console.error("[client-errors] failed to record crash report", error);
  }

  return noContent();
}
