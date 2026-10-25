import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRobloxProfile, parseSteamProfile, parseSteamPage, parseCoffeeProfile, fetchCommunityProfile, COMMUNITY_LINKS } from '../lib/community-profiles.mjs'
import { createTtlCache } from '../lib/ttl-cache.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const steamXml = (body = '') => `<profile><steamID64>76561198765816074</steamID64><steamID><![CDATA[COOLman]]></steamID>${body}</profile>`
const steamPage = (hours = '3.5', games = '16') => `g_rgProfileData = {"steamid":"76561198765816074"};\n<div class="recentgame_quicklinks recentgame_recentplaytime"><div>${hours} hours past 2 weeks</div></div><a href="https://steamcommunity.com/id/coolmanyt1/games/?tab=all"><span class="count_link_label">Games</span><span class="profile_count_link_total">${games}</span></a>`

test('Steam uses displayed playtime and library totals rather than the unreliable XML zero', async () => {
  const xml = steamXml('<privacyState>public</privacyState><onlineState>online</onlineState><hoursPlayed2Wk>0.0</hoursPlayed2Wk>')
  const data = await fetchCommunityProfile('steam', async (url) => new Response(url.includes('xml=1') ? xml : steamPage()))
  assert.deepEqual(data.stats.map((stat) => stat.value), [3.5, 16])
  assert.equal(data.providerStatus, 'healthy')
  const unavailable = await fetchCommunityProfile('steam', async (url) => new Response(url.includes('xml=1') ? xml : '<html>Sign in</html>'))
  assert.deepEqual(unavailable.stats.map((stat) => stat.value), [null, null])
  assert.equal(unavailable.providerStatus, 'degraded')
  assert.equal(unavailable.stats[1].url, `${COMMUNITY_LINKS.steam}/games/?tab=all`)
})

test('Steam page parsing preserves genuine zero and rejects unrelated account totals', () => {
  assert.deepEqual(parseSteamPage(steamPage('0', '0')), { hours: 0, games: 0 })
  assert.deepEqual(parseSteamPage(steamPage('1,234.5', '1,234')), { hours: 1234.5, games: 1234 })
  assert.deepEqual(parseSteamPage(steamPage().replace('"steamid":"76561198765816074"', '"steamid":"123"')), { hours: null, games: null })
})

test('Steam current game links are derived from the matching app, never a different recent game', () => {
  const xml = steamXml('<privacyState>public</privacyState><onlineState>in-game</onlineState><stateMessage><![CDATA[In-Game<br/>Portal 2]]></stateMessage><mostPlayedGame><gameName><![CDATA[Portal 2]]></gameName><gameLink><![CDATA[https://steamcommunity.com/app/620]]></gameLink></mostPlayedGame>')
  assert.equal(parseSteamProfile(xml).gameUrl, 'https://store.steampowered.com/app/620/')
  assert.equal(parseSteamProfile(xml.replace('<gameName><![CDATA[Portal 2]]>', '<gameName><![CDATA[Other game]]>')).gameUrl, undefined)
})

const coffeePage = (creator = {}, extra = {}) => `<script data-page="app" type="application/json">${JSON.stringify({ props: { creator_data: { data: { slug: 'coolmanyt', name: 'COOLman', currency: 'AUD', coffee_price: '5.0000', tag_alternative: 'pizza', ...creator } }, ...extra } })}</script>`

test('Coffee returns real creator details while respecting hidden supporter totals and locked posts', () => {
  const data = parseCoffeeProfile(coffeePage({ supporter_count: false, public_supporter_count: 42, description: '<p>Coding &amp; videos</p>', dp: 'https://evil.test/a', membership_enabled: true }, {
    membership_levels: { data: [{ title: 'Member', price_monthly: 3 }] },
    featured_posts: { data: [{ project_update_heading: 'Public', project_update_slug: 'public', is_post_unlocked: true, is_published: true }, { project_update_heading: 'Members only', project_update_slug: 'locked', is_post_unlocked: false, is_published: true, project_update_description: 'SECRET' }] },
  }))
  assert.equal(data.supporters, null)
  assert.equal(data.bio, 'Coding & videos')
  assert.equal(data.price, 5)
  assert.equal(data.currency, 'AUD')
  assert.equal(data.item, 'pizza')
  assert.equal(data.avatarUrl, undefined)
  assert.equal(data.memberships[0].price, 3)
  assert.equal(Object.hasOwn(data, 'posts'), false)
  assert.doesNotMatch(JSON.stringify(data), /SECRET|Members only/)
  assert.equal(parseCoffeeProfile(coffeePage({ supporter_count: true, public_supporter_count: 0 })).supporters, 0)
  assert.throws(() => parseCoffeeProfile('<html>Sign in</html>'))
  assert.throws(() => parseCoffeeProfile(coffeePage({ slug: 'another-account' })))
})

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
  assert.equal(data.stats[0].value, null) // The misleading legacy XML hours must never be displayed.
  assert.equal(data.stats[1].value, null)
  assert.equal(data.stats[1].url, `${COMMUNITY_LINKS.steam}/games/?tab=all`)
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

test('Steam game titles remain literal text after removing the known presence prefix', () => {
  const title = 'Cats < Dogs > Mice & Friends'
  const data = parseSteamProfile(steamXml(`<privacyState>public</privacyState><onlineState>in-game</onlineState><stateMessage><![CDATA[In-Game<br/>${title}]]></stateMessage>`))
  assert.equal(data.game, title)
  assert.equal(data.gameUrl, undefined)
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
