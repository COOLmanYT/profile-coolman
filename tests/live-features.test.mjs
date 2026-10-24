import assert from 'node:assert/strict'
import test from 'node:test'
import { createGithubActivityLoader, GITHUB_CACHE_MS, summarizeGithubEvents } from '../lib/github-activity.mjs'
import { readAnnouncement } from '../lib/live-announcement.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const event = (extra = {}) => ({ id: '1', public: true, type: 'PushEvent', repo: { name: 'COOLmanYT/profile-coolman' }, created_at: '2026-10-24T00:00:00Z', payload: { commits: [{ message: 'not for display', author: { email: 'private@example.invalid' } }] }, ...extra })

test('GitHub activity includes only supported public events and derives trusted links', () => {
  const items = summarizeGithubEvents([
    event({ public: false }), event({ repo: { name: 'https://evil.invalid/repo' } }), event({ created_at: 'invalid' }),
    event({ type: 'WatchEvent' }), event(),
    event({ id: '2', type: 'PullRequestEvent', payload: { number: 37, pull_request: { merged: true, html_url: 'javascript:alert(1)' } } }),
    event({ id: '3', type: 'IssuesEvent', payload: { issue: { number: 10 } } }),
    event({ id: '4', type: 'ReleaseEvent' }), event({ id: '5', type: 'ForkEvent' }),
  ])
  assert.equal(items.length, 4)
  assert.equal(items[0].label, 'Pushed code')
  assert.equal(items[1].label, 'Merged a pull request')
  assert.equal(items[1].url, 'https://github.com/COOLmanYT/profile-coolman/pull/37')
  assert.equal(items[2].url, 'https://github.com/COOLmanYT/profile-coolman/issues/10')
  assert.equal(JSON.stringify(items).includes('private@example.invalid'), false)
  assert.equal(JSON.stringify(items).includes('not for display'), false)
  assert.throws(() => summarizeGithubEvents({}), /Invalid GitHub/)
})

test('GitHub caches concurrent visitors for 15 minutes and revalidates using ETag without credentials', async () => {
  let now = 1000
  const calls = []
  const loader = createGithubActivityLoader({ now: () => now, fetcher: async (url, init) => {
    calls.push({ url, init })
    if (calls.length === 1) return Response.json([event()], { headers: { ETag: '"v1"' } })
    return new Response(null, { status: 304, headers: { 'X-Poll-Interval': '1800' } })
  } })
  const responses = await Promise.all(Array.from({ length: 20 }, () => loader.get()))
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/events\/public\?per_page=30$/)
  assert.equal(calls[0].init.headers.Authorization, undefined)
  now += GITHUB_CACHE_MS - 1
  assert.deepEqual(await loader.get(), responses[0])
  assert.equal(calls.length, 1)
  now += 1
  assert.deepEqual(await loader.get(), responses[0])
  assert.equal(calls[1].init.headers['If-None-Match'], '"v1"')
  now += GITHUB_CACHE_MS
  await loader.get()
  assert.equal(calls.length, 2, 'respect a longer upstream polling interval')
})

test('GitHub rate-limit and network failures cool down instead of fetching for each visitor', async () => {
  for (const status of [403, 429, 503, 'network']) {
    let now = 1_000_000, calls = 0
    const loader = createGithubActivityLoader({ now: () => now, fetcher: async () => {
      calls++
      if (calls > 1) return Response.json([])
      if (status === 'network') throw new Error('offline')
      return new Response(null, { status, headers: { 'Retry-After': '120', 'X-RateLimit-Reset': '1300' } })
    } })
    await assert.rejects(loader.get())
    await assert.rejects(loader.get())
    assert.equal(calls, 1)
    now += 300_001
    assert.deepEqual((await loader.get()).items, [])
    assert.equal(calls, 2)
  }
})

test('GitHub does not report stale cached activity as healthy after a failed refresh', async () => {
  let now = 0, calls = 0
  const loader = createGithubActivityLoader({ now: () => now, fetcher: async () => ++calls === 1 ? Response.json([event()]) : Response.json({}, { status: 503 }) })
  await loader.get()
  now += GITHUB_CACHE_MS
  await assert.rejects(loader.get())
  await assert.rejects(loader.get())
  assert.equal(calls, 2)
})

test('GitHub route shares only successful public results through the CDN', async () => {
  for (const fail of [false, true]) {
    const { GET } = loadTypescript('app/api/github/route.ts', {
      'next/server': nextServer,
      '@/lib/github-activity.mjs': { createGithubActivityLoader },
      '@/lib/provider-monitor.mjs': { monitoredFetch: async () => fail ? new Response(null, { status: 429, headers: { 'Retry-After': '120' } }) : Response.json([event()]) },
      '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed: true }) },
    })
    const response = await GET({})
    assert.equal(response.status, fail ? 503 : 200)
    assert.equal(response.headers.get('Cache-Control'), fail ? 'no-store' : 'public, max-age=0, must-revalidate')
    assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), fail ? null : 'max-age=900')
    if (fail) assert.equal(response.headers.get('Retry-After'), '120')
  }
})

test('announcements disappear when cleared, cap text, and reject unsafe optional links', () => {
  for (const kv of [undefined, null, {}, { announcement: '  ' }, { announcement: 2 }]) assert.equal(readAnnouncement(kv), null)
  assert.deepEqual(readAnnouncement({ announcement: ' New video! ', announcement_url: 'https://www.youtube.com/watch?v=hello' }), { message: 'New video!', url: 'https://www.youtube.com/watch?v=hello' })
  assert.equal(readAnnouncement({ announcement: 'a'.repeat(1000) }).message.length, 280)
  for (const announcement_url of ['javascript:alert(1)', 'data:text/html,test', '//evil.invalid', 'https://user:pass@example.com', 'http://example.com']) {
    assert.equal(readAnnouncement({ announcement: 'hello', announcement_url }).url, null)
  }
  assert.equal(readAnnouncement({ announcement: '<b>plain text</b>' }).message, '<b>plain text</b>')
})
