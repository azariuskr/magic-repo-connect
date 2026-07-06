// Very small in-memory sliding-window rate limiter. Scope: per-worker
// instance. Good enough to blunt casual abuse of public endpoints
// (form submissions, checkout). For strict multi-region limits swap the
// backing store for KV / Durable Objects later.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { ok: true, remaining: limit - 1, resetAt: next.resetAt };
  }
  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** Throw a user-facing error if `key` has exceeded `limit` in `windowMs`. */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const res = checkRateLimit(key, limit, windowMs);
  if (!res.ok) {
    const secs = Math.max(1, Math.ceil((res.resetAt - Date.now()) / 1000));
    throw new Error(`Too many requests. Try again in ${secs}s.`);
  }
}

// Periodic cleanup to keep the map bounded on long-lived workers.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, 60_000);
}
