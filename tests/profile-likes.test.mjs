import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import { loadTypescript } from './load-typescript.mjs'
import * as identity from '../lib/profile-likes.mjs'

const firstId = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
function request({ id = firstId, cookie, origin = 'https://profile.test', site = 'same-origin' } = {}) {
  return { url: 'https://profile.test/api/likes', headers: new Headers({ origin, 'sec-fetch-site': site, ...(id ? { 'x-profile-browser-id': id } : {}) }), cookies: { get: () => cookie ? { value: cookie } : undefined } }
}
function route({ missing = false, failed = false, allowed = true } = {}) {
  const hashes = new Set(), calls = [], cookies = []
  const db = {
    from: (table) => ({ select: () => ({ eq: (_key, value) => ({ maybeSingle: async () => ({ error: failed ? {} : null, data: table === 'profile_like_totals' ? { count: hashes.size } : hashes.has(value) ? { browser_hash: value } : null }) }) }) }),
    rpc: async (_fn, args) => {
      calls.push(args.p_browser_hash)
      const added = !hashes.has(args.p_browser_hash)
      if (!failed) hashes.add(args.p_browser_hash)
      return { data: { count: hashes.size, added }, error: failed ? {} : null }
    },
  }
  const handlers = loadTypescript('app/api/likes/route.ts', {
    'node:crypto': { createHash, randomUUID },
    'next/server': { NextResponse: { json: (body, options) => { const response = Response.json(body, options); response.cookies = { set: (...args) => cookies.push(args) }; return response } } },
    '@/lib/supabase-server': { getSupabase: () => missing ? null : db },
    '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed }) },
    '@/lib/profile-likes.mjs': identity,
  })
  return { ...handlers, hashes, calls, cookies }
}

test('repeated and simultaneous submissions count a browser once and persist a long-lived server cookie', async () => {
  const handlers = route()
  const responses = await Promise.all(Array.from({ length: 5 }, () => handlers.POST(request())))
  const bodies = await Promise.all(responses.map((response) => response.json()))
  assert.equal(handlers.hashes.size, 1)
  assert.equal(bodies.filter((body) => body.added).length, 1)
  assert.ok(bodies.every((body) => body.count === 1 && body.liked))
  assert.equal(handlers.calls[0], createHash('sha256').update(firstId).digest('hex'))
  assert.equal(handlers.cookies[0][2].httpOnly, true)
  assert.equal(handlers.cookies[0][2].maxAge, 400 * 24 * 60 * 60)
})

test('the server cookie takes priority over a replaced local identity and GET restores liked state', async () => {
  const handlers = route()
  await handlers.POST(request())
  const repeated = await (await handlers.POST(request({ cookie: firstId, id: secondId }))).json()
  assert.equal(repeated.added, false)
  assert.equal(repeated.browserId, firstId)
  const restored = await (await handlers.GET(request({ cookie: firstId, id: null }))).json()
  assert.equal(restored.liked, true)
  assert.equal(restored.count, 1)
  assert.equal((await (await handlers.POST(request({ id: secondId }))).json()).count, 2)
})

test('likes reject cross-site requests, malformed identities and rate limits before writing', async () => {
  const handlers = route()
  for (const options of [{ origin: 'https://other.test' }, { site: 'cross-site' }]) assert.equal((await handlers.POST(request(options))).status, 403)
  assert.equal((await handlers.POST(request({ id: 'arbitrary' }))).status, 400)
  assert.equal((await handlers.POST(request({ id: null }))).status, 400)
  assert.equal((await route({ allowed: false }).POST(request())).status, 429)
  assert.deepEqual(handlers.calls, [])
})

test('missing or failed storage returns unavailable without an invented count or successful receipt', async () => {
  for (const options of [{ missing: true }, { failed: true }]) {
    const handlers = route(options)
    for (const method of ['GET', 'POST']) {
      const response = await handlers[method](request())
      assert.equal(response.status, 503)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.equal((await response.json()).count, undefined)
    }
    assert.deepEqual(handlers.cookies, [])
  }
})
