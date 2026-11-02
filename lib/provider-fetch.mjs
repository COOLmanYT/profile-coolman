import { retryAfterMs } from './widget-polling.mjs'

// Per-instance cooldown only. Successful responses keep their existing freshness.
export function createProviderFetcher(provider, fetcher, now = Date.now) {
  let blockedUntil = 0
  const remainingSeconds = () => Math.max(0, Math.ceil((blockedUntil - now()) / 1000))

  return {
    get retryAfterSeconds() { return remainingSeconds() },
    async fetch(input, init) {
      if (remainingSeconds() > 0) throw new Error('Provider rate limited')
      const response = await fetcher(provider, input, init)
      if (response.status === 429) {
        const observedAt = now()
        const resetAt = Number(response.headers.get('Ratelimit-Reset')) * 1000
        const resetDelay = Number.isFinite(resetAt) ? Math.max(0, resetAt - observedAt) : 0
        const delay = Math.max(retryAfterMs(response.headers.get('Retry-After'), observedAt), resetDelay) || 60_000
        // A later response from an already-running request must not shorten the wait.
        blockedUntil = Math.max(blockedUntil, observedAt + delay)
      }
      return response
    },
  }
}
