import { NextResponse } from "next/server";

// Lightweight in-memory fixed-window rate limiter for a single Node instance.
// Defense-in-depth for write/abuse-prone endpoints; the primary auth brute-force
// defense should be edge rate rules (e.g. Cloudflare) in production.
// For multi-instance deployments, swap this for a shared store (Redis).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP from proxy headers.
 *
 * Trust order matters: in production ZidRun sits behind Cloudflare → Caddy, so
 * `cf-connecting-ip` is set by Cloudflare's edge and CANNOT be spoofed by the client
 * (Cloudflare overwrites any client-supplied value). `x-real-ip` is set by the trusted
 * Caddy hop. Only fall back to `x-forwarded-for` (client-appendable, spoofable) for
 * local/dev where no trusted proxy is present. Returns null when no IP is available.
 *
 * IMPORTANT: for authenticated endpoints prefer `rateLimitKey("scope", session.user.id)`
 * over IP keys — the session id is not spoofable and gives an exact per-user limit.
 */
export function clientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && forwarded.length > 0 ? forwarded : null;
}

/** Namespaced rate-limit key, e.g. rateLimitKey("upload", userId). */
export function rateLimitKey(scope: string, identifier: string): string {
  return `${scope}:${identifier}`;
}

/**
 * Enforce a rate limit and return a ready-to-send 429 NextResponse when exceeded,
 * or null when the request may proceed. Centralizes the Retry-After wiring so every
 * route responds identically.
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const result = checkRateLimit(key, limit, windowMs);
  if (result.ok) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down.", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
  );
}
