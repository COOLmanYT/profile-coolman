/** Poll sequentially, suspend in hidden tabs, and discard cancelled responses. */
export function startPolling({ poll, onError, intervalMs, maxDelayMs = Math.max(intervalMs, 300_000), timeoutMs = 15_000, visibility = globalThis.document, timers = globalThis }) {
  let stopped = false
  let timer
  let controller
  let failures = 0

  function pause() {
    timers.clearTimeout(timer)
    controller?.abort()
    controller = undefined
  }

  async function run() {
    if (stopped || visibility.hidden || controller) return
    const request = new AbortController()
    controller = request
    const timeout = timers.setTimeout(() => request.abort(), timeoutMs)
    let retryMs = 0
    try {
      await poll(request.signal)
      if (request.signal.aborted) throw new Error('Request timed out')
      failures = 0
    } catch (error) {
      if (!stopped && controller === request) {
        failures += 1
        retryMs = Number.isFinite(error?.retryAfterMs) ? error.retryAfterMs : 0
        onError()
      }
    } finally {
      timers.clearTimeout(timeout)
      if (controller === request) {
        controller = undefined
        if (!stopped && !visibility.hidden) {
          timer = timers.setTimeout(run, Math.max(retryMs, Math.min(maxDelayMs, intervalMs * 2 ** Math.min(failures, 10))))
        }
      }
    }
  }

  function onVisibilityChange() {
    if (visibility.hidden) pause()
    else void run()
  }

  visibility.addEventListener('visibilitychange', onVisibilityChange)
  void run()
  return () => {
    stopped = true
    pause()
    visibility.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

export function retryAfterMs(value, now = Date.now()) {
  if (!value) return 0
  const seconds = Number(value)
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now
  return Number.isFinite(delay) ? Math.max(0, delay) : 0
}

const cooldowns = new Map()
export async function fetchWidgetJson(url, signal) {
  const remaining = (cooldowns.get(url) ?? 0) - Date.now()
  if (remaining > 0) throw Object.assign(new Error('Widget cooling down'), { retryAfterMs: remaining })
  cooldowns.delete(url)
  // Honour response cache headers, including the CDN-only fallback cache.
  const response = await fetch(url, { signal })
  if (!response.ok) {
    const delay = retryAfterMs(response.headers.get('Retry-After'))
    if (delay > 0) cooldowns.set(url, Date.now() + delay)
    throw Object.assign(new Error(`Widget request failed (${response.status})`), { retryAfterMs: delay })
  }
  const data = await response.json()
  if (!data || data.providerStatus === 'unavailable') throw new Error('Provider unavailable')
  return data
}
