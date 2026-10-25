import assert from 'node:assert/strict'
import test, { beforeEach, afterEach } from 'node:test'
import { DEFAULT_TOGGLES } from '../lib/toggle-defaults.mjs'
import { DASHBOARD_GROUPS, DASHBOARD_LABELS, isControlDisabled } from '../lib/dashboard-controls.mjs'
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

test('YouTube module and section controls persist independently through owner settings', async () => {
  for (const id of ['youtube', 'youtube_stats', 'youtube_latest', 'youtube_live', 'youtube_shorts', 'youtube_videos']) {
    assert.equal(DEFAULT_TOGGLES[id], true)
    const route = toggleRoute()
    assert.equal((await route.POST(request({ id, value: false }))).status, 200)
    assert.equal(route.writes[0].id, id)
    assert.equal(route.writes[0].value, false)
    assert.deepEqual(route.invalidations, ['/'])
  }
})

test('community modules and details persist independently through owner settings', async () => {
  for (const id of Object.keys(DEFAULT_TOGGLES).filter((key) => /^(roblox|steam|buymeacoffee)(_|$)/.test(key))) {
    assert.equal(DEFAULT_TOGGLES[id], id !== 'buymeacoffee_bio')
    const route = toggleRoute()
    assert.equal((await route.POST(request({ id, value: false }))).status, 200)
    assert.equal(route.writes[0].id, id)
    assert.equal(route.writes[0].value, false)
    assert.deepEqual(route.invalidations, ['/'])
  }
})

test('global dashboard exposes every supported toggle exactly once with a label and valid parent', () => {
  const controls = DASHBOARD_GROUPS.flatMap(({ parentKey, keys }) => {
    assert.ok(Object.hasOwn(DEFAULT_TOGGLES, parentKey), parentKey)
    return keys
  })
  assert.equal(new Set(controls).size, controls.length)
  assert.deepEqual([...controls].sort(), Object.keys(DEFAULT_TOGGLES).sort())
  for (const id of controls) assert.ok(typeof DASHBOARD_LABELS[id] === 'string' && DASHBOARD_LABELS[id].length > 0, id)
  assert.equal(controls.includes('buymeacoffee_posts'), false)
})

test('global bio defaults off, can be enabled explicitly, and section dependencies match rendering', async () => {
  assert.equal(DEFAULT_TOGGLES.buymeacoffee_bio, false)
  const route = toggleRoute()
  assert.equal((await route.POST(request({ id: 'buymeacoffee_bio', value: true }))).status, 200)
  assert.equal(route.writes[0].value, true)
  assert.equal(isControlDisabled('steam_hours', 'steam', { steam_activity: false }), true)
  assert.equal(isControlDisabled('steam_name', 'steam', { steam_activity: false }), false)
  assert.equal(isControlDisabled('roblox_followers', 'roblox', { roblox_stats: false }), true)
  assert.equal(isControlDisabled('steam_activity', 'steam', { steam: false }), true)
  assert.equal(isControlDisabled('steam', 'steam', { steam: false }), false)
})

test('the embed default is off and changing it invalidates both the profile and visitor settings', async () => {
  assert.equal(DEFAULT_TOGGLES.youtube_embed_default, false)
  const route = toggleRoute()
  assert.equal((await route.POST(request({ id: 'youtube_embed_default', value: true }))).status, 200)
  assert.deepEqual(route.invalidations, ['/', '/options'])
  assert.equal(route.writes[0].value, true)
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
