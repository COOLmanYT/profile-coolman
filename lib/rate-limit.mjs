// Best-effort per-process protection. Fleet-wide enforcement belongs at the edge.
export function createRateLimiter({ maxBuckets = 10_000, cleanupIntervalMs = 1_000 } = {}) {
  const buckets = new Map()
  let nextCleanup = 0

  function cleanup(now) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
    nextCleanup = now + cleanupIntervalMs
  }

  return {
    get size() { return buckets.size },
    take(key, { limit, windowMs }, now = Date.now()) {
      if (now >= nextCleanup) cleanup(now)
      const current = buckets.get(key)
      if (!current || current.resetAt <= now) {
        if (!current && buckets.size >= maxBuckets) cleanup(now)
        // Reject new identities at capacity; never evict an active limit to admit one.
        if (!current && buckets.size >= maxBuckets) return { allowed: false, remaining: 0, retryAfterSeconds: 1 }
        buckets.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
      }
      current.count = Math.min(limit + 1, current.count + 1)
      return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
    },
  }
}

const limiter = createRateLimiter()

export function clientAddress(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

export function takeRateLimit(key, { limit, windowMs }, now = Date.now()) {
  return limiter.take(key, { limit, windowMs }, now)
}

export function limitPublicRequest(request, route, limit = 90) {
  return takeRateLimit(`${route}:${clientAddress(request)}`, { limit, windowMs: 60_000 })
}
