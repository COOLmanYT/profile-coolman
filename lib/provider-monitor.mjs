export const SLOW_PROVIDER_REQUEST_MS = 2500
const failures = new Map()
const ALERT_AFTER_FAILURES = 3
const ALERT_COOLDOWN_MS = 15 * 60 * 1000
const alertTimes = new Map()

function recordProviderIssue(issue) {
  if (issue.kind === 'slow_response') return
  const count = (failures.get(issue.provider) ?? 0) + 1
  failures.set(issue.provider, count)
  const webhook = process.env.PROVIDER_ALERT_WEBHOOK_URL
  const lastAlert = alertTimes.get(issue.provider) ?? 0
  if (!webhook || count < ALERT_AFTER_FAILURES || Date.now() - lastAlert < ALERT_COOLDOWN_MS) return
  alertTimes.set(issue.provider, Date.now())
  failures.set(issue.provider, 0)
  void fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `⚠ ${issue.provider} has failed ${count} consecutive provider requests (${issue.kind}).` }) }).catch(() => undefined)
}

function clearProviderFailures(provider) {
  failures.delete(provider)
}

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
    if (issue) {
      console.warn('[provider-monitor]', JSON.stringify(issue))
      recordProviderIssue(issue)
    } else {
      clearProviderFailures(provider)
    }
    return response
  } catch (error) {
    const issue = providerIssue(provider, performance.now() - startedAt, undefined, error)
    console.error('[provider-monitor]', JSON.stringify(issue))
    recordProviderIssue(issue)
    throw error
  }
}
