export const GITHUB_USERNAME = 'COOLmanYT'
export const GITHUB_CACHE_MS = 15 * 60 * 1000

/** Deliberately omit commit messages, author emails, and arbitrary upstream URLs. */
export function summarizeGithubEvents(events) {
  if (!Array.isArray(events)) throw new Error('Invalid GitHub activity')
  return events.flatMap(event => {
    if (!event || event.public !== true || typeof event.id !== 'string'
      || !/^[\w.-]+\/[\w.-]+$/.test(event.repo?.name ?? '')
      || !Number.isFinite(Date.parse(event.created_at))) return []
    const repo = event.repo.name
    const base = `https://github.com/${repo}`
    const payload = event.payload ?? {}
    let label, url = base
    switch (event.type) {
      case 'PushEvent': label = 'Pushed code'; break
      case 'PullRequestEvent': {
        const number = payload.number ?? payload.pull_request?.number
        if (!Number.isSafeInteger(number) || number <= 0) return []
        label = payload.pull_request?.merged === true ? 'Merged a pull request' : `${payload.action === 'closed' ? 'Closed' : payload.action === 'opened' ? 'Opened' : 'Updated'} a pull request`
        url = `${base}/pull/${number}`
        break
      }
      case 'IssuesEvent': {
        const number = payload.issue?.number
        if (!Number.isSafeInteger(number) || number <= 0) return []
        label = payload.action === 'opened' ? 'Opened an issue' : payload.action === 'closed' ? 'Closed an issue' : 'Updated an issue'
        url = `${base}/issues/${number}`
        break
      }
      case 'ReleaseEvent': label = 'Published a release'; url = `${base}/releases`; break
      case 'CreateEvent': label = payload.ref_type === 'repository' ? 'Created a repository' : 'Created a branch or tag'; break
      case 'ForkEvent': label = 'Forked a repository'; break
      default: return []
    }
    return [{ id: event.id, repo, label, url, createdAt: event.created_at }]
  }).slice(0, 4)
}

export class GithubUnavailableError extends Error {
  constructor(retryAfterSeconds) { super('GitHub activity unavailable'); this.retryAfterSeconds = retryAfterSeconds }
}

/** Per-instance single flight and cooldown; the CDN shares public results across visitors. */
export function createGithubActivityLoader({ fetcher = fetch, now = Date.now } = {}) {
  let cached, etag, expiresAt = 0, blockedUntil = 0, pending
  const unavailable = () => new GithubUnavailableError(Math.max(1, Math.ceil((blockedUntil - now()) / 1000)))
  async function load() {
    try {
      const response = await fetcher(`https://api.github.com/users/${GITHUB_USERNAME}/events/public?per_page=30`, {
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(etag ? { 'If-None-Match': etag } : {}) },
        // No credentials: this module can only read public activity.
        cache: 'no-store',
      })
      if (!response.ok && response.status !== 304) {
        const retry = Number(response.headers.get('Retry-After')) * 1000
        const reset = Number(response.headers.get('X-RateLimit-Reset')) * 1000 - now()
        const delay = Math.max(60_000, Number.isFinite(retry) ? retry : 0, response.status === 403 || response.status === 429 ? (Number.isFinite(reset) ? reset : 0) : 0)
        blockedUntil = now() + Math.min(delay, 24 * 60 * 60 * 1000)
        throw unavailable()
      }
      if (response.status !== 304) {
        const items = summarizeGithubEvents(await response.json())
        cached = { providerStatus: 'healthy', username: GITHUB_USERNAME, profileUrl: `https://github.com/${GITHUB_USERNAME}`, items, updatedAt: now() }
        etag = response.headers.get('ETag')
      }
      if (!cached) throw new Error('GitHub returned no activity snapshot')
      const pollMs = Number(response.headers.get('X-Poll-Interval')) * 1000
      expiresAt = now() + Math.max(GITHUB_CACHE_MS, Number.isFinite(pollMs) ? Math.min(pollMs, 86_400_000) : 0)
      return cached
    } catch (error) {
      if (!(error instanceof GithubUnavailableError)) blockedUntil = now() + 60_000
      throw unavailable()
    }
  }
  return {
    get() {
      if (blockedUntil > now()) return Promise.reject(unavailable())
      if (cached && expiresAt > now()) return Promise.resolve(cached)
      if (!pending) pending = load().finally(() => { pending = undefined })
      return pending
    },
  }
}
