export const GITHUB_USERNAME = 'COOLmanYT'
export const GITHUB_CACHE_MS = 60 * 60 * 1000
const PROFILE_URL = `https://github.com/${GITHUB_USERNAME}`
const API_URL = 'https://api.github.com'
const DAY_MS = 86_400_000
export function yearlyCommitQuery(now = Date.now()) {
  const end = new Date(now).toISOString().slice(0, 10)
  const start = new Date(now - 365 * DAY_MS).toISOString().slice(0, 10)
  return `author:${GITHUB_USERNAME} author-date:${start}..${end} is:public`
}
const attribute = (tag, name) => new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1]

/** Parse GitHub's own public calendar into data; never publish upstream HTML. */
export function parseContributionCalendar(html) {
  if (typeof html !== 'string' || html.length > 2_000_000) throw new Error('Invalid GitHub calendar')
  const counts = new Map()
  for (const [, attrs, text] of html.matchAll(/<tool-tip\b([^>]*)>([^<]*)<\/tool-tip>/g)) {
    const id = attribute(attrs, 'for'), match = /^(No|[\d,]+) contributions?\b/.exec(text.trim())
    if (id && match) counts.set(id, match[1] === 'No' ? 0 : Number(match[1].replaceAll(',', '')))
  }
  const days = []
  for (const [, attrs] of html.matchAll(/<td\b([^>]*)>/g)) {
    const date = attribute(attrs, 'data-date')
    if (!date) continue
    const level = Number(attribute(attrs, 'data-level')), count = counts.get(attribute(attrs, 'id'))
    const timestamp = Date.parse(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
      || new Date(timestamp).toISOString().slice(0, 10) !== date
      || !Number.isInteger(level) || level < 0 || level > 4
      || !Number.isSafeInteger(count) || count < 0) throw new Error('Invalid GitHub calendar day')
    days.push({ date, count, level })
  }
  days.sort((a, b) => a.date.localeCompare(b.date))
  if (days.length < 365 || days.length > 371 || new Date(`${days[0].date}T00:00:00Z`).getUTCDay() !== 0
    || days.some((day, index) => index > 0 && Date.parse(day.date) - Date.parse(days[index - 1].date) !== DAY_MS)) throw new Error('Incomplete GitHub calendar')
  return { days, total: days.reduce((sum, day) => sum + day.count, 0), url: PROFILE_URL }
}

/** Read only the public status fields. Upstream markup is never rendered. */
export function parseGithubStatus(html) {
  if (typeof html !== 'string' || html.length > 2_000_000 || !html.includes('vcard-names')) throw new Error('Invalid GitHub profile')
  const section = className => {
    const start = new RegExp(`<div\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, 'i').exec(html)
    if (!start) return ''
    const tail = html.slice(start.index + start[0].length)
    let depth = 1
    for (const tag of tail.matchAll(/<\/?div\b[^>]*>/gi)) {
      depth += tag[0].startsWith('</') ? -1 : 1
      if (!depth) return tail.slice(0, tag.index)
    }
    throw new Error('Incomplete GitHub status')
  }
  const text = value => value.replace(/<[^>]*>/g, '').replace(/&#(x[0-9a-f]+|[0-9]+);|&(amp|lt|gt|quot|apos|nbsp);/gi, (entity, numeric, named) => {
    if (named) return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[named.toLowerCase()]
    const code = numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
  }).replace(/\s+/g, ' ').trim()
  const message = text(section('user-status-message-wrapper')).slice(0, 160)
  const emoji = text(section('user-status-emoji-container')).slice(0, 32)
  return message || emoji ? { message, emoji } : null
}

function publicRepository(repo) {
  if (!repo || typeof repo.private !== 'boolean' || typeof repo.full_name !== 'string') throw new Error('Invalid GitHub repository')
  if (repo.private) return null
  const [owner, name, extra] = repo.full_name.split('/')
  if (owner?.toLowerCase() !== GITHUB_USERNAME.toLowerCase()) return null
  if (extra || !/^[\w.-]+$/.test(name ?? '') || /^\.+$/.test(name)) throw new Error('Invalid GitHub repository name')
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null
  return {
    name, url: `${PROFILE_URL}/${encodeURIComponent(name)}`, updatedAt: date(repo.pushed_at) ?? date(repo.updated_at),
    defaultBranch: typeof repo.default_branch === 'string' ? repo.default_branch : null,
    stars: Number.isSafeInteger(repo.stargazers_count) && repo.stargazers_count >= 0 ? repo.stargazers_count : null,
    language: typeof repo.language === 'string' ? repo.language.trim().slice(0, 50) || null : null,
    licence: repo.license && typeof repo.license.name === 'string' ? {
      name: repo.license.name.slice(0, 100),
      label: typeof repo.license.spdx_id === 'string' && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id.slice(0, 50) : 'Custom licence',
    } : null,
    fork: repo.fork === true, archived: repo.archived === true,
  }
}

/** The requested commit title and canonical link, without author emails or message bodies. */
export function summarizeCommit(commits, repository) {
  const commit = Array.isArray(commits) ? commits[0] : null
  if (!commit || !/^[a-f0-9]{40}$/i.test(commit.sha ?? '') || typeof commit.commit?.message !== 'string') return null
  const title = commit.commit.message.split(/\r?\n/, 1)[0].trim().slice(0, 160)
  return title ? { title, sha: commit.sha, url: `${repository.url}/commit/${commit.sha}` } : null
}

export class GithubUnavailableError extends Error {
  constructor(retryAfterSeconds) { super('GitHub profile unavailable'); this.retryAfterSeconds = retryAfterSeconds }
}

/** One refresh per instance, bounded requests, ETags and shared upstream cooldowns. */
export function createGithubActivityLoader({ fetcher = fetch, now = Date.now } = {}) {
  let cached, expiresAt = 0, blockedUntil = 0, statusBlockedUntil = 0, pending
  const resources = new Map()
  const unavailable = () => new GithubUnavailableError(Math.max(1, Math.ceil((blockedUntil - now()) / 1000)))
  async function request(url, html = false, optional = false) {
    if (blockedUntil > now() || (optional && statusBlockedUntil > now())) throw unavailable()
    const previous = resources.get(url)
    try {
      const response = await fetcher(url, {
        headers: { Accept: html ? 'text/html' : 'application/vnd.github+json', 'User-Agent': 'profile-coolman',
          ...(!html ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}), ...(previous?.etag ? { 'If-None-Match': previous.etag } : {}) },
        cache: 'no-store',
      })
      if (response.status === 304 && previous) return previous
      if (response.status === 409 && url.includes('/commits?')) return { data: [], more: false }
      if (!response.ok) {
        const seconds = Number(response.headers.get('Retry-After'))
        const retry = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(response.headers.get('Retry-After') ?? '') - now()
        const reset = Number(response.headers.get('X-RateLimit-Reset')) * 1000 - now()
        const delay = Math.max(60_000, Number.isFinite(retry) ? retry : 0, response.status === 403 || response.status === 429 ? (Number.isFinite(reset) ? reset : 0) : 0)
        if (optional) {
          statusBlockedUntil = now() + Math.min(delay, DAY_MS)
          throw new Error('Optional GitHub profile unavailable')
        }
        blockedUntil = now() + Math.min(delay, DAY_MS)
        throw unavailable()
      }
      const value = { data: html ? await response.text() : await response.json(), etag: response.headers.get('ETag'), more: /rel="next"/.test(response.headers.get('Link') ?? '') }
      if (resources.size >= 64 && !resources.has(url)) resources.delete(resources.keys().next().value)
      resources.set(url, value)
      return value
    } catch (error) {
      if (optional) { statusBlockedUntil = Math.max(statusBlockedUntil, now() + GITHUB_CACHE_MS); throw error }
      if (!(error instanceof GithubUnavailableError)) blockedUntil = now() + 60_000
      throw unavailable()
    }
  }
  async function repositories() {
    const repos = new Map()
    for (let page = 1; page <= 5; page++) {
      const result = await request(`${API_URL}/users/${GITHUB_USERNAME}/repos?type=owner&sort=pushed&per_page=100&page=${page}`)
      if (!Array.isArray(result.data)) throw new Error('Invalid GitHub repositories')
      for (const raw of result.data) { const repo = publicRepository(raw); if (repo) repos.set(repo.name, repo) }
      if (!result.more) return { repos: [...repos.values()], complete: true }
    }
    return { repos: [...repos.values()], complete: false }
  }
  async function load() {
    const commitQuery = yearlyCommitQuery(now())
    const [repoResult, calendarResult, commitCountResult, statusResult] = await Promise.allSettled([
      repositories(), request(`https://github.com/users/${GITHUB_USERNAME}/contributions`, true).then(result => parseContributionCalendar(result.data)),
      request(`${API_URL}/search/commits?q=${encodeURIComponent(commitQuery)}&per_page=1`).then(result => {
        if (result.data?.incomplete_results !== false || !Number.isSafeInteger(result.data.total_count) || result.data.total_count < 0) throw new Error('Incomplete GitHub commit count')
        return result.data.total_count
      }),
      request(PROFILE_URL, true, true).then(result => parseGithubStatus(result.data)),
    ])
    if (repoResult.status === 'rejected') {
      if (blockedUntil <= now()) blockedUntil = now() + 60_000
      throw unavailable()
    }
    const { repos, complete } = repoResult.value
    let degraded = !complete || calendarResult.status === 'rejected' || commitCountResult.status === 'rejected'
    const recent = repos.filter(repo => !repo.fork && !repo.archived && repo.updatedAt && repo.defaultBranch)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 3)
    const projects = await Promise.all(recent.map(async repo => {
      let commit = null
      try {
        const result = await request(`${API_URL}/repos/${GITHUB_USERNAME}/${encodeURIComponent(repo.name)}/commits?sha=${encodeURIComponent(repo.defaultBranch)}&per_page=1`)
        commit = summarizeCommit(result.data, repo)
        if (!commit && result.data?.length !== 0) degraded = true
      } catch { degraded = true }
      return { name: repo.name, url: repo.url, updatedAt: repo.updatedAt, defaultBranch: repo.defaultBranch, stars: repo.stars, language: repo.language, licence: repo.licence, commit }
    }))
    const starsKnown = complete && repos.every(repo => repo.stars !== null)
    if (!starsKnown) degraded = true
    cached = { status: statusResult.status === 'fulfilled' ? statusResult.value : null, statusUnavailable: statusResult.status === 'rejected', providerStatus: degraded ? 'degraded' : 'healthy', username: GITHUB_USERNAME, profileUrl: PROFILE_URL,
      totalStars: starsKnown ? repos.reduce((sum, repo) => sum + repo.stars, 0) : null, publicRepos: complete ? repos.length : null,
      commitsPastYear: commitCountResult.status === 'fulfilled' ? commitCountResult.value : null,
      commitsUrl: `https://github.com/search?q=${encodeURIComponent(commitQuery)}&type=commits`,
      calendar: calendarResult.status === 'fulfilled' ? calendarResult.value : null, projects, updatedAt: now() }
    expiresAt = now() + (degraded ? 5 * 60_000 : GITHUB_CACHE_MS)
    return cached
  }
  return { get() {
    if (cached && expiresAt > now()) return Promise.resolve(cached)
    if (blockedUntil > now()) return Promise.reject(unavailable())
    if (!pending) pending = load().finally(() => { pending = undefined })
    return pending
  } }
}
