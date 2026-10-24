import assert from 'node:assert/strict'
import test from 'node:test'
import { createGithubActivityLoader, GITHUB_CACHE_MS, parseContributionCalendar, summarizeCommit, yearlyCommitQuery } from '../lib/github-activity.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as jsxRuntime from 'react/jsx-runtime'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const DAY = 86_400_000
const sha = 'a'.repeat(40)
const repo = (name = 'profile-coolman', extra = {}) => ({ private: false, full_name: `COOLmanYT/${name}`, stargazers_count: 2, pushed_at: '2026-10-24T00:00:00Z', default_branch: 'main', ...extra })
const commit = (title = 'Improve the profile') => [{ sha, commit: { message: `${title}\n\nCo-authored-by: someone <private@example.invalid>`, author: { email: 'private@example.invalid' } }, html_url: 'javascript:alert(1)' }]
const date = index => new Date(Date.parse('2025-10-19T00:00:00Z') + index * DAY).toISOString().slice(0, 10)
const calendarHtml = Array.from({ length: 371 }, (_, i) => `<td data-level="${i % 5}" id="day-${i}" data-date="${date(i)}"></td><tool-tip for="day-${i}">${i === 0 ? '1,234' : 'No'} contributions on a date.</tool-tip>`).reverse().join('')
const json = (body, headers = {}) => Response.json(body, { headers })

function upstream(repos = [repo()], changes = {}) {
  return async (url, init) => {
    assert.equal(init.headers.Authorization, undefined)
    if (changes.handle) { const response = changes.handle(url, init); if (response) return response }
    if (url.includes('/search/commits?')) return json({ total_count: 522, incomplete_results: false, items: [{ author: { email: 'private@example.invalid' } }] }, { ETag: '"year"' })
    if (url.includes('/contributions')) return new Response(calendarHtml, { headers: { ETag: '"calendar"' } })
    if (url.includes('/commits?')) return json(commit(), { ETag: '"commit"' })
    return json(repos, { ETag: '"repos"' })
  }
}

test('calendar parser sorts GitHub row-order cells, retains real levels/counts and rejects partial or malformed markup', () => {
  const calendar = parseContributionCalendar(calendarHtml)
  assert.equal(calendar.days.length, 371)
  assert.equal(calendar.days[0].date, '2025-10-19')
  assert.equal(calendar.days[0].count, 1234)
  assert.equal(calendar.total, 1234)
  assert.equal(calendar.days[1].count, 0)
  assert.equal(calendar.days[1].level, 1)
  for (const invalid of ['', '<html>Please sign in</html>', calendarHtml.replace('data-level="0"', 'data-level="5"'), calendarHtml.replace('data-date="2025-10-19"', 'data-date="2025-10-20"'), calendarHtml.replace('for="day-0"', 'for="missing"')]) assert.throws(() => parseContributionCalendar(invalid))
})

test('GitHub snapshot totals public owned repositories, sums stars, and links recent original projects to default-branch commits', async () => {
  const calls = []
  const loader = createGithubActivityLoader({ fetcher: async (url, init) => {
    calls.push(url)
    return upstream([
      repo('old', { pushed_at: '2026-01-01T00:00:00Z' }), repo('new', { pushed_at: '2026-10-24T01:00:00Z', default_branch: 'feature/main', language: 'TypeScript', license: { spdx_id: 'MIT', name: 'MIT License' } }),
      repo('fork', { fork: true, stargazers_count: 3 }), repo('archived', { archived: true }),
      repo('private', { private: true, stargazers_count: 100 }), repo('foreign', { full_name: 'someone/foreign' }),
    ])(url, init)
  } })
  const profile = await loader.get()
  assert.equal(profile.providerStatus, 'healthy')
  assert.equal(profile.publicRepos, 4)
  assert.equal(profile.totalStars, 9)
  assert.equal(profile.commitsPastYear, 522)
  assert.deepEqual(profile.projects.map(item => item.name), ['new', 'old'])
  assert.equal(profile.projects[0].url, 'https://github.com/COOLmanYT/new')
  assert.equal(profile.projects[0].commit.url, `https://github.com/COOLmanYT/new/commit/${sha}`)
  assert.equal(profile.projects[0].commit.title, 'Improve the profile')
  assert.equal(profile.projects[0].updatedAt, '2026-10-24T01:00:00Z')
  assert.equal(profile.projects[0].language, 'TypeScript')
  assert.deepEqual(profile.projects[0].licence, { name: 'MIT License', label: 'MIT' })
  assert.equal(profile.projects[1].licence, null)
  assert.equal(calls.some(url => url.includes('sha=feature%2Fmain')), true)
  assert.equal(JSON.stringify(profile).includes('private@example.invalid'), false)
  assert.equal(JSON.stringify(profile).includes('javascript:'), false)
})

test('totals include every repository page and never misrepresent a bounded partial sum as a total', async () => {
  let pages = 0
  const loader = createGithubActivityLoader({ fetcher: upstream([], { handle: url => {
    if (!url.includes('/repos?')) return
    pages++
    return json([repo(`r${pages}`, { archived: true })], pages === 1 ? { Link: '<https://api.github.com/ignored>; rel="next"' } : {})
  } }) })
  assert.equal((await loader.get()).publicRepos, 2)
  assert.equal(pages, 2)
  let boundedCalls = 0
  const bounded = createGithubActivityLoader({ fetcher: upstream([], { handle: url => {
    if (!url.includes('/repos?')) return
    boundedCalls++
    return json([repo(`r${boundedCalls}`, { archived: true })], { Link: '<https://evil.invalid>; rel="next"' })
  } }) })
  const partial = await bounded.get()
  assert.equal(boundedCalls, 5)
  assert.equal(partial.totalStars, null)
  assert.equal(partial.publicRepos, null)
  assert.equal(partial.providerStatus, 'degraded')
})

test('concurrent visitors share one hourly snapshot and ETags revalidate all resources without credentials', async () => {
  let now = 0
  const calls = []
  const loader = createGithubActivityLoader({ now: () => now, fetcher: async (url, init) => {
    calls.push({ url, init })
    if (init.headers['If-None-Match']) return new Response(null, { status: 304 })
    return upstream()(url, init)
  } })
  const results = await Promise.all(Array.from({ length: 20 }, () => loader.get()))
  assert.equal(calls.length, 4)
  now += GITHUB_CACHE_MS - 1
  assert.deepEqual(await loader.get(), results[0])
  assert.equal(calls.length, 4)
  now++
  assert.deepEqual((await loader.get()).projects, results[0].projects)
  assert.equal(calls.length, 8)
  assert.equal(calls.slice(4).every(call => Boolean(call.init.headers['If-None-Match'])), true)
})

test('partial provider failures retain real stats and projects while missing graph/commits stay unavailable', async () => {
  for (const failure of ['calendar', 'commit', 'stars']) {
    const loader = createGithubActivityLoader({ fetcher: upstream([repo('project', failure === 'stars' ? { stargazers_count: null } : {})], { handle: url => {
      if (failure === 'calendar' && url.includes('/contributions')) return new Response('<html>Markup changed</html>')
      if (failure === 'commit' && url.includes('/commits?')) return new Response(null, { status: 503 })
    } }) })
    const result = await loader.get()
    assert.equal(result.providerStatus, 'degraded')
    assert.equal(result.publicRepos, 1)
    assert.equal(result.totalStars, failure === 'stars' ? null : 2)
    assert.equal(result.calendar === null, failure === 'calendar')
    assert.equal(result.projects[0].commit === null, failure === 'commit')
  }
  const empty = await createGithubActivityLoader({ fetcher: upstream([]) }).get()
  assert.equal(empty.publicRepos, 0)
  assert.equal(empty.totalStars, 0)
  assert.deepEqual(empty.projects, [])
})

test('GitHub failure cooldown prevents per-visitor refetching and expires before recovery', async () => {
  for (const status of [403, 429, 503, 'network']) {
    let now = 1_000_000, failed = true, requests = 0
    const loader = createGithubActivityLoader({ now: () => now, fetcher: async (url, init) => {
      requests++
      if (!failed) return upstream([])(url, init)
      if (status === 'network') throw new Error('offline')
      return new Response(null, { status, headers: { 'Retry-After': '120', 'X-RateLimit-Reset': '1300' } })
    } })
    await assert.rejects(loader.get())
    const firstCalls = requests
    await assert.rejects(loader.get())
    assert.equal(requests, firstCalls)
    failed = false
    now += 300_001
    assert.equal((await loader.get()).publicRepos, 0)
  }
})

test('GitHub route caches healthy snapshots longer than partial snapshots and never caches total failure', async () => {
  for (const mode of ['healthy', 'degraded', 'failed']) {
    const { GET } = loadTypescript('app/api/github/route.ts', {
      'next/server': nextServer, '@/lib/github-activity.mjs': { createGithubActivityLoader },
      '@/lib/provider-monitor.mjs': { monitoredFetch: async (_provider, url, init) => {
        if (mode === 'failed') return new Response(null, { status: 429, headers: { 'Retry-After': '120' } })
        if (mode === 'degraded' && url.includes('/contributions')) return new Response('Invalid graph')
        return upstream()(url, init)
      } }, '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed: true }) },
    })
    const response = await GET({})
    assert.equal(response.status, mode === 'failed' ? 503 : 200)
    assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), mode === 'failed' ? null : mode === 'degraded' ? 'max-age=60' : 'max-age=3600')
    if (mode === 'failed') {
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.equal(response.headers.get('Retry-After'), '120')
    }
  }
})

test('commit titles remain plain text, use their real SHA and reject invalid payloads', () => {
  const project = { url: 'https://github.com/COOLmanYT/project' }
  assert.equal(summarizeCommit(commit('<b>literal title</b>'), project).title, '<b>literal title</b>')
  for (const payload of [null, [], {}, [{ sha: 'bad', commit: { message: 'hello' } }]]) assert.equal(summarizeCommit(payload, project), null)
})

test('yearly commit count uses one bounded author/date/public query and never treats incomplete results as zero', async () => {
  assert.equal(yearlyCommitQuery(Date.parse('2026-10-24T12:00:00Z')), 'author:COOLmanYT author-date:2025-10-24..2026-10-24 is:public')
  for (const result of [{ total_count: 0, incomplete_results: false }, { total_count: 522, incomplete_results: true }, { total_count: -1, incomplete_results: false }]) {
    let searches = 0
    const profile = await createGithubActivityLoader({ fetcher: upstream([], { handle: url => {
      if (url.includes('/search/commits?')) {
        searches++
        assert.equal(new URL(url).searchParams.get('per_page'), '1')
        return json(result)
      }
    } }) }).get()
    assert.equal(searches, 1)
    assert.equal(profile.commitsPastYear, result.incomplete_results === false && result.total_count === 0 ? 0 : null)
  }
})

test('compact GitHub card keeps real links and metadata, and each section control hides its content', async () => {
  const profile = await createGithubActivityLoader({ fetcher: upstream([repo('sample-project', { language: 'TypeScript', license: { spdx_id: 'MIT', name: 'MIT License' } })]) }).get()
  function render(props = {}) {
    let state = 0
    const { default: Widget } = loadTypescript('components/GithubWidget.tsx', {
      react: { useEffect: () => {}, useState: () => [state++ === 0 ? profile : false, () => {}] },
      'react/jsx-runtime': jsxRuntime, '@/lib/widget-polling.mjs': { startPolling: () => () => {}, fetchWidgetJson: () => {} },
    })
    return renderToStaticMarkup(createElement(Widget, props))
  }
  const visible = render()
  assert.match(visible, /<svg[^>]*aria-hidden="true"/)
  assert.match(visible, /522/)
  assert.match(visible, /TypeScript/)
  assert.match(visible, /MIT/)
  assert.match(visible, /sample-project\/commit\//)
  assert.doesNotMatch(visible, /Latest on/)
  for (const [flag, text] of [['showGraph', 'Contributions · past year'], ['showStats', 'Public repos'], ['showCommitCount', 'Commits · past year'], ['showProjects', 'sample-project'], ['showLanguage', 'TypeScript'], ['showLicence', 'MIT'], ['showCommitTitles', 'Improve the profile']]) {
    assert.equal(render({ [flag]: false }).includes(text), false, flag)
  }
  assert.equal(render({ showProfile: false }).includes('@COOLmanYT'), false)
})
