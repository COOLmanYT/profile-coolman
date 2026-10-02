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
    try {
      await poll(request.signal)
      if (request.signal.aborted) throw new Error('Request timed out')
      failures = 0
    } catch {
      if (!stopped && controller === request) {
        failures += 1
        onError()
      }
    } finally {
      timers.clearTimeout(timeout)
      if (controller === request) {
        controller = undefined
        if (!stopped && !visibility.hidden) {
          timer = timers.setTimeout(run, Math.min(maxDelayMs, intervalMs * 2 ** Math.min(failures, 10)))
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

export async function fetchWidgetJson(url, signal) {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Widget request failed (${response.status})`)
  const data = await response.json()
  if (!data || data.providerStatus === 'unavailable') throw new Error('Provider unavailable')
  return data
}
