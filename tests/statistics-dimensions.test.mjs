import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { siteConfig } from '../lib/site-config.mjs'
import { validateSiteConfig } from '../lib/config-validation.mjs'
import * as dimensions from '../lib/statistics-dimensions.mjs'
import * as likes from '../lib/profile-likes.mjs'
import { loadTypescript } from './load-typescript.mjs'

const nextServer = createRequire(import.meta.url)('next/server')
const policy = () => ({ ...siteConfig.analytics.collect })
const agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
const collection = loadTypescript('lib/statistics-collection.ts', { './supabase-server': { getSupabase: () => null } })
function request(path = '/api/views', { body = { referrer: 'https://google.com/search?q=secret#private' }, headers = {}, cookie = false } = {}) {
  return new nextServer.NextRequest(`https://profile.coolmanyt.com${path}`, { method: 'POST', headers: { origin: 'https://profile.coolmanyt.com', 'content-type': 'application/json', 'user-agent': agent, 'x-vercel-ip-country': 'AU', ...(cookie ? { cookie: 'profile_view_counted=1' } : {}), ...headers }, body: JSON.stringify(body) })
}
function route(path = 'app/api/views/route.ts', { flags = policy(), config = siteConfig, failed = false, rate = true } = {}) {
  const calls = [], reads = []
  const loaded = loadTypescript(path, {
    'next/server': nextServer,
    '@/lib/site-config.mjs': { siteConfig: config, isModuleAvailable: id => config.modules[id]?.enabled },
    '@/lib/supabase-server': { getSupabase: () => ({ rpc: async (...args) => { calls.push(args); return { data: 100, error: failed ? {} : null } }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { count: 99 } }) }) }) }) }) },
    '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed: rate, retryAfterSeconds: 30 }) },
    '@/lib/statistics-collection': { readSmallJson: collection.readSmallJson, getCollectionPolicy: async () => { reads.push(1); return flags } },
    '@/lib/statistics-dimensions.mjs': dimensions, '@/lib/profile-likes.mjs': likes,
  })
  return { ...loaded, calls, reads }
}

test('collection config requires explicit booleans and rejects misspelled category switches', () => {
  for (const modify of [c => { c.analytics.collect.country = 'false' }, c => { delete c.analytics.collect.browser }, c => { c.analytics.collect.countries = false }, c => { c.analytics.enabled = 1 }]) {
    const config = structuredClone(siteConfig); modify(config)
    assert.throws(() => validateSiteConfig(config), /analytics/)
  }
  const config = structuredClone(siteConfig)
  for (const key of dimensions.COLLECTION_KEYS) config.analytics.collect[key] = false
  assert.ok(validateSiteConfig(config))
})

test('referrers and destinations discard URL details and reject private or executable destinations', () => {
  assert.equal(dimensions.referrerDomain('https://www.google.com/search?q=email@example.test#secret', 'https://profile.coolmanyt.com'), 'google.com')
  assert.equal(dimensions.referrerDomain('https://profile.coolmanyt.com/options', 'https://profile.coolmanyt.com'), 'Internal')
  assert.equal(dimensions.referrerDomain('', ''), 'Direct / Unknown')
  assert.equal(dimensions.referrerDomain('http://192.168.1.1/secret', ''), 'Direct / Unknown')
  assert.equal(dimensions.referrerDomain('http://[::1]/secret', ''), 'Direct / Unknown')
  assert.equal(dimensions.referrerDomain('https://user:password@private.test/path', ''), 'Direct / Unknown')
  assert.equal(dimensions.destinationKey('https://youtube.com/watch?v=private&token=secret#id', siteConfig), 'youtube.com')
  assert.equal(dimensions.destinationKey('/options?token=secret#fragment', siteConfig), '/options')
  for (const href of ['/dashboard', '/auth/signin', '/api/views', 'javascript:alert(1)', 'mailto:test@example.test']) assert.equal(dimensions.destinationKey(href, siteConfig), null)
  assert.equal(dimensions.destinationKey('https://random-unlisted.example/path?secret=1', siteConfig), 'Other external')
  for (const value of ['random-unlisted.example', 'youtube.com?token=secret', '/dashboard', 'https://youtube.com']) assert.equal(dimensions.validDestinationKey(value, siteConfig), false)
})

test('counted views add only enabled buckets atomically, while repeats do no collection work', async () => {
  const previous = process.env.VERCEL; process.env.VERCEL = '1'
  try {
    const api = route()
    const response = await api.POST(request())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(api.calls[0][0], 'increment_profile_views_with_dimensions')
    const data = api.calls[0][1].p_dimensions
    assert.equal(data.country, 'AU'); assert.equal(data.referrer, 'google.com')
    assert.equal(data.device, 'Desktop'); assert.equal(data.os, 'Windows'); assert.equal(data.browser, 'Chrome')
    assert.match(data.hour, /^\d{2}$/)
    assert.doesNotMatch(JSON.stringify(data), /secret|133|Mozilla|email/)
    for (const key of ['country','time','referrer','device','os','browser']) {
      const flags = policy(); flags[key] = false
      const disabled = route(undefined, { flags }); await disabled.POST(request())
      assert.equal(key === 'time' ? 'hour' in disabled.calls[0][1].p_dimensions : key in disabled.calls[0][1].p_dimensions, false)
    }
    const repeat = route(); await repeat.POST(request('/api/views', { cookie: true }))
    assert.deepEqual(repeat.calls, []); assert.deepEqual(repeat.reads, [])
  } finally { if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous }
})

test('privacy signals and disabled collection preserve the base counter without collecting metadata', async () => {
  for (const headers of [{ dnt: '1' }, { 'sec-gpc': '1' }]) {
    const api = route(); await api.POST(request('/api/views', { headers }))
    assert.deepEqual(api.calls, [['increment_profile_views']])
    assert.deepEqual(api.reads, [])
  }
  const flags = Object.fromEntries(dimensions.COLLECTION_KEYS.map(key => [key, false]))
  const api = route(undefined, { flags }); await api.POST(request())
  assert.deepEqual(api.calls, [['increment_profile_views']])
  const local = route(); const previous = process.env.VERCEL; delete process.env.VERCEL
  try { await local.POST(request()); assert.equal(local.calls[0][1].p_dimensions.country, 'Unknown') } finally { if (previous !== undefined) process.env.VERCEL = previous }
})

test('view writes reject cross-site requests and rate limits before database work', async () => {
  for (const headers of [{ origin: 'https://other.test' }, { 'sec-fetch-site': 'cross-site' }]) {
    const api = route(); assert.equal((await api.POST(request('/api/views', { headers }))).status, 403); assert.deepEqual(api.calls, [])
  }
  const api = route(undefined, { rate: false }); assert.equal((await api.POST(request())).status, 429); assert.deepEqual(api.calls, [])
})

test('outbound writes obey config, global policy, privacy signals, destination validation and rate limits', async () => {
  const path = 'app/api/views/click/route.ts'
  const api = route(path)
  assert.equal((await api.POST(request('/api/views/click', { body: { destination: 'youtube.com' } }))).status, 204)
  assert.deepEqual(api.calls, [['record_profile_statistics_dimensions', { p_dimensions: { outbound: 'youtube.com' } }]])
  const disabledConfig = structuredClone(siteConfig); disabledConfig.analytics.collect.outbound = false
  for (const options of [{ config: disabledConfig }, { flags: { ...policy(), outbound: false } }]) {
    const disabled = route(path, options); assert.equal((await disabled.POST(request())).status, 204); assert.deepEqual(disabled.calls, [])
  }
  for (const headers of [{ dnt: '1' }, { 'sec-gpc': '1' }]) { const disabled = route(path); assert.equal((await disabled.POST(request('/api/views/click', { headers }))).status, 204); assert.deepEqual(disabled.calls, []) }
  assert.equal((await api.POST(request('/api/views/click', { body: { destination: '/dashboard' } }))).status, 400)
  assert.equal((await api.POST(request('/api/views/click', { body: { destination: 'youtube.com', payload: 'x'.repeat(5000) } }))).status, 400)
  assert.equal((await route(path, { rate: false }).POST(request())).status, 429)
  assert.equal((await route(path, { failed: true }).POST(request('/api/views/click', { body: { destination: 'youtube.com' } }))).status, 503)
})

test('collection policy fails closed on missing/failed settings, and applies both config and the existing global toggle', async () => {
  for (const scenario of ['missing', 'error', 'throws', 'off', 'on', 'default', 'config-off']) {
    const config = structuredClone(siteConfig); if (scenario === 'config-off') config.analytics.enabled = false
    const loaded = loadTypescript('lib/statistics-collection.ts', {
      './site-config.mjs': { siteConfig: config, isModuleAvailable: () => true },
      './supabase-server': {
        getSupabase: () => scenario === 'missing' ? null : {
          from: () => {
            if (scenario === 'throws') throw new Error('offline')
            return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: scenario === 'default' ? null : { value: scenario === 'on' }, error: scenario === 'error' ? {} : null }) }) }) }
          },
        },
      },
    })
    const flags = await loaded.getCollectionPolicy()
    assert.equal(Object.values(flags).some(Boolean), ['on', 'default'].includes(scenario), scenario)
  }
})

test('small-body reader also limits streamed bodies without a content-length header', async () => {
  const req = new Request('https://profile.test', { method: 'POST', body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5000)); controller.close() } }), duplex: 'half' })
  await assert.rejects(collection.readSmallJson(req), /Body too large/)
})
