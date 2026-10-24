import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRobloxProfile, parseSteamProfile, fetchCommunityProfile, COMMUNITY_LINKS } from '../lib/community-profiles.mjs'
import { createTtlCache } from '../lib/ttl-cache.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const steamXml = (body = '') => `<profile><steamID64>76561198765816074</steamID64><steamID><![CDATA[COOLman]]></steamID>${body}</profile>`

test('Roblox keeps real zero counts distinct from unavailable or malformed totals', () => {
  const data = parseRobloxProfile({ id: 2873599962, name: 'owner', displayName: 'COOLman' }, { data: [{ targetId: 2873599962, state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/avatar.png' }] }, [{ count: 0 }, null, { count: -1 }])
  assert.deepEqual(data.stats.map((stat) => stat.value), [0, null, null])
  assert.equal(data.name, 'COOLman')
  assert.equal(data.providerStatus, 'degraded')
  assert.equal(data.avatarUrl, 'https://tr.rbxcdn.com/avatar.png')
  assert.throws(() => parseRobloxProfile({ id: 123, name: 'other' }, null, []))
})

test('provider avatar URLs must use the expected HTTPS CDN', () => {
  for (const imageUrl of ['javascript:alert(1)', 'https://rbxcdn.com.evil.test/image', 'http://tr.rbxcdn.com/a', 'https://user@tr.rbxcdn.com/a']) {
    assert.equal(parseRobloxProfile({ id: 2873599962, name: 'owner' }, { data: [{ targetId: 2873599962, state: 'Completed', imageUrl }] }, []).avatarUrl, undefined)
  }
  assert.equal(parseSteamProfile(steamXml('<avatarFull>https://evil.test/avatar</avatarFull>')).avatarUrl, undefined)
})

test('Steam reads public activity without exposing real name, location or profile markup', () => {
  const data = parseSteamProfile(steamXml('<privacyState>public</privacyState><onlineState>in-game</onlineState><stateMessage><![CDATA[In-Game<br/>Portal &amp; Friends]]></stateMessage><hoursPlayed2Wk>0.0</hoursPlayed2Wk><memberSince>November 26, 2025</memberSince><realname>PRIVATE NAME</realname><location>PRIVATE LOCATION</location>'))
  assert.equal(data.status, 'in-game')
  assert.equal(data.game, 'Portal &amp; Friends') // CDATA is already literal text.
  assert.equal(data.stats[0].value, 0)
  assert.equal(data.stats[1].value, 'November 26, 2025')
  assert.equal(data.providerStatus, 'healthy')
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE/)
})

test('private or missing Steam presence is unknown, and withheld hours are not zero', () => {
  for (const privacy of ['', '<privacyState>private</privacyState>']) {
    const data = parseSteamProfile(steamXml(`${privacy}<onlineState>offline</onlineState><hoursPlayed2Wk>0</hoursPlayed2Wk>`))
    assert.equal(data.status, 'unknown')
    assert.equal(data.game, undefined)
    assert.equal(data.stats[0].value, null)
    assert.equal(data.providerStatus, 'degraded')
  }
  assert.equal(parseSteamProfile(steamXml('<privacyState>public</privacyState><onlineState>offline</onlineState>')).status, 'offline')
  assert.throws(() => parseSteamProfile('<html>Sign in</html>'))
  assert.throws(() => parseSteamProfile(steamXml().replace('76561198765816074', '123')))
})

test('Steam XML entities are decoded once and invalid numeric entities stay literal', () => {
  const data = parseSteamProfile(steamXml().replace('<![CDATA[COOLman]]>', 'A &amp;lt; &#x1f3ae; &#1114112;'))
  assert.equal(data.name, 'A &lt; 🎮 &#1114112;')
})

test('Roblox optional endpoint failures retain the verified profile with missing counts', async () => {
  const urls = []
  const data = await fetchCommunityProfile('roblox', async (url, options) => {
    urls.push(url)
    assert.ok(options.signal instanceof AbortSignal)
    if (url.startsWith('https://users.roblox.com/')) return Response.json({ id: 2873599962, name: 'owner' })
    if (url.includes('/friends/count')) return Response.json({ count: 12 })
    throw new Error('provider unavailable')
  })
  assert.equal(urls.length, 5)
  assert.deepEqual(data.stats.map((stat) => stat.value), [12, null, null])
  assert.equal(data.providerStatus, 'degraded')
})

test('fetchers reject upstream error pages and unknown services', async () => {
  await assert.rejects(fetchCommunityProfile('steam', async () => new Response('offline', { status: 503 })))
  await assert.rejects(fetchCommunityProfile('roblox', async () => new Response('offline', { status: 503 })))
  let called = false
  await assert.rejects(fetchCommunityProfile('arbitrary-url', async () => { called = true }))
  assert.equal(called, false)
  assert.equal(COMMUNITY_LINKS.buymeacoffee, 'https://buymeacoffee.com/coolmanyt')
})

function routeWith({ allowed = true, fail = false } = {}) {
  const calls = []
  const route = loadTypescript('app/api/community/[service]/route.ts', {
    'next/server': nextServer,
    '@/lib/community-profiles.mjs': { fetchCommunityProfile: async (service) => { calls.push(service); if (fail) throw new Error('offline'); return { name: 'COOLman' } } },
    '@/lib/ttl-cache.mjs': { createTtlCache },
    '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed, retryAfterSeconds: 30 }) },
  })
  return { ...route, calls }
}
const context = (service) => ({ params: Promise.resolve({ service }) })

test('community API caches requests per service and rejects unrecognized providers', async () => {
  const route = routeWith()
  for (const service of ['roblox', 'roblox', 'steam']) assert.equal((await route.GET({}, context(service))).status, 200)
  assert.deepEqual(route.calls, ['roblox', 'steam'])
  assert.equal((await route.GET({}, context('constructor'))).status, 404)
  assert.deepEqual(route.calls, ['roblox', 'steam'])
})

test('community API failures and rate limits cannot be cached as healthy responses', async () => {
  const failed = await routeWith({ fail: true }).GET({}, context('steam'))
  assert.equal(failed.status, 503)
  assert.equal(failed.headers.get('Cache-Control'), 'no-store')
  assert.equal((await failed.json()).providerStatus, 'unavailable')
  const limited = routeWith({ allowed: false })
  const response = await limited.GET({}, context('roblox'))
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '30')
  assert.deepEqual(limited.calls, [])
})
