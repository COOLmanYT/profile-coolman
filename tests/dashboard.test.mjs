import assert from 'node:assert/strict'
import test, { beforeEach, afterEach } from 'node:test'
import { DEFAULT_TOGGLES } from '../lib/toggle-defaults.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const keys = ['DISCORD_USER_ID', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
let original
beforeEach(() => {
  original = keys.map((key) => process.env[key])
  process.env.DISCORD_USER_ID = 'owner'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
})
afterEach(() => keys.forEach((key, i) => {
  if (original[i] === undefined) delete process.env[key]
  else process.env[key] = original[i]
}))

function toggleRoute({ session = { user: { id: 'owner' } }, error = null, throws = false } = {}) {
  const writes = [], invalidations = []
  const route = loadTypescript('app/api/dashboard/toggle/route.ts', {
    'next/server': nextServer,
    'next-auth': { getServerSession: async () => session },
    '@/lib/auth': { authOptions: {} },
    '@/lib/toggle-defaults.mjs': { DEFAULT_TOGGLES },
    'next/cache': { revalidatePath: (path) => invalidations.push(path) },
    '@/lib/supabase-server': { getSupabase: () => !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY ? null : ({ from: () => ({ upsert: async (row) => { writes.push(row); if (throws) throw new Error('offline'); return { error } } }) }) },
  })
  return { ...route, writes, invalidations }
}
const request = (body) => ({ json: async () => body })

test('toggle saves persist the value before invalidating the homepage', async () => {
  const route = toggleRoute()
  assert.equal((await route.POST(request({ id: 'spotify', value: false }))).status, 200)
  assert.equal(route.writes[0].value, false)
  assert.deepEqual(route.invalidations, ['/'])
})

test('toggle save rejects missing database configuration without success or invalidation', async () => {
  for (const key of keys.slice(1)) {
    const value = process.env[key]
    delete process.env[key]
    const route = toggleRoute()
    assert.equal((await route.POST(request({ id: 'spotify', value: false }))).status, 503)
    assert.deepEqual(route.writes, [])
    assert.deepEqual(route.invalidations, [])
    process.env[key] = value
  }
})

test('failed database writes never invalidate or report a successful save', async () => {
  for (const options of [{ error: { message: 'failed' } }, { throws: true }]) {
    const route = toggleRoute(options)
    assert.equal((await route.POST(request({ id: 'twitch', value: false }))).status, 500)
    assert.deepEqual(route.invalidations, [])
  }
})

test('toggle saves require the configured owner and reject bad payloads', async () => {
  for (const [session, expected] of [[null, 401], [{ user: { id: 'other' } }, 403], [{ user: {} }, 403]]) {
    const route = toggleRoute({ session })
    assert.equal((await route.POST(request({ id: 'spotify', value: false }))).status, expected)
    assert.deepEqual(route.writes, [])
  }
  for (const body of [null, { id: 'unknown', value: true }, { id: '__proto__', value: true }, { id: 'spotify', value: 'false' }]) {
    const route = toggleRoute()
    assert.equal((await route.POST(request(body))).status, 400)
    assert.deepEqual(route.writes, [])
  }
  const route = toggleRoute()
  assert.equal((await route.POST({ json: async () => { throw new SyntaxError() } })).status, 400)
  delete process.env.DISCORD_USER_ID
  assert.equal((await toggleRoute().POST(request({ id: 'spotify', value: false }))).status, 403)
})

test('shared toggle loader merges valid stored values and preserves independent defaults', async () => {
  const { getToggles } = loadTypescript('lib/toggles.ts', {
    './toggle-defaults.mjs': { DEFAULT_TOGGLES },
    './supabase-server': { getSupabase: () => !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY ? null : ({ from: () => ({ select: async () => ({ data: [{ id: 'spotify', value: false }, { id: 'unknown', value: true }, { id: 'twitch', value: 'false' }] }) }) }) },
  })
  const toggles = await getToggles()
  assert.equal(toggles.spotify, false)
  assert.equal(toggles.twitch, true)
  assert.equal(toggles.unknown, undefined)
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const defaults = await getToggles()
  assert.deepEqual(defaults, DEFAULT_TOGGLES)
  defaults.spotify = false
  assert.equal(DEFAULT_TOGGLES.spotify, true)
})

test('seasonal settings invalidate public pages only after a successful save and require owner access', async () => {
  for (const [session, saved, expected] of [[{ user: { id: 'owner' } }, true, 200], [{ user: { id: 'owner' } }, false, 500], [null, true, 401], [{ user: { id: 'other' } }, true, 401]]) {
    const invalidations = [], writes = []
    const { POST } = loadTypescript('app/api/dashboard/seasons/route.ts', {
      'next/server': nextServer, 'next/cache': { revalidatePath: (path) => invalidations.push(path) },
      'next-auth': { getServerSession: async () => session }, '@/lib/auth': { authOptions: {} },
      '@/lib/seasonal': { normaliseSeasonalSettings: (settings) => settings },
      '@/lib/site-settings': { saveSeasonalSettings: async (settings) => { writes.push(settings); return saved } },
    })
    assert.equal((await POST(request({ enabled: false }))).status, expected)
    assert.deepEqual(invalidations, expected === 200 ? ['/', '/options'] : [])
    if (expected === 401) assert.deepEqual(writes, [])
  }
})
