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

/** Best-effort client IP from proxy headers. Returns null when no trustworthy IP is present. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && forwarded.length > 0 ? forwarded : null;
}
