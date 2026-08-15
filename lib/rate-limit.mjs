const buckets = new Map()

export function clientAddress(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

export function takeRateLimit(key, { limit, windowMs }, now = Date.now()) {
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs }
    buckets.set(key, next)
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }
  current.count += 1
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
}

export function limitPublicRequest(request, route, limit = 90) {
  return takeRateLimit(`${route}:${clientAddress(request)}`, { limit, windowMs: 60_000 })
}
