export const SLOW_PROVIDER_REQUEST_MS = 2500

export function providerIssue(provider, durationMs, status, error) {
  if (error) return { provider, kind: 'network_error', durationMs: Math.round(durationMs) }
  if (typeof status === 'number' && status >= 400) return { provider, kind: 'upstream_error', status, durationMs: Math.round(durationMs) }
  if (durationMs >= SLOW_PROVIDER_REQUEST_MS) return { provider, kind: 'slow_response', status, durationMs: Math.round(durationMs) }
  return null
}

export async function monitoredFetch(provider, input, init, fetcher = fetch) {
  const startedAt = performance.now()
  try {
    const response = await fetcher(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) })
    const issue = providerIssue(provider, performance.now() - startedAt, response.status)
    if (issue) console.warn('[provider-monitor]', JSON.stringify(issue))
    return response
  } catch (error) {
    const issue = providerIssue(provider, performance.now() - startedAt, undefined, error)
    console.error('[provider-monitor]', JSON.stringify(issue))
    throw error
  }
}
