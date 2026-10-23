import assert from 'node:assert/strict'
import test from 'node:test'
import { createTtlCache } from '../lib/ttl-cache.mjs'
import { createSpotifyFetcher, SpotifyCooldownError } from '../lib/spotify-fetch.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const rateLimit = { limitPublicRequest: () => ({ allowed: true }) }
const request = { nextUrl: new URL('https://test.invalid/api/spotify') }
const json = (body, status = 200) => Response.json(body, { status })

async function withSpotify(upstream, run) {
  const values = { SPOTIFY_CLIENT_ID: 'client', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' }
  const original = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]))
  Object.assign(process.env, values)
  try {
    const route = loadTypescript('app/api/spotify/route.ts', {
      'next/server': nextServer, '@/lib/rate-limit.mjs': rateLimit,
      '@/lib/ttl-cache.mjs': { createTtlCache },
      '@/lib/spotify-fetch.mjs': { createSpotifyFetcher, SpotifyCooldownError },
      '@/lib/provider-monitor.mjs': { monitoredFetch: async (_provider, url) => upstream(url) },
    })
    await run(route.GET)
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('concurrent visitors share playback while history remains uncached and separate', async () => {
  const calls = []
  await withSpotify(url => {
    calls.push(url)
    if (url.includes('/api/token')) return json({ access_token: 'token' })
    if (url.includes('recently-played')) return json({ items: [] })
    return json({ is_playing: true, progress_ms: 1000, item: { id: 'a'.repeat(22), name: 'Song', duration_ms: 100_000, artists: [] } })
  }, async GET => {
    const responses = await Promise.all(Array.from({ length: 10 }, () => GET(request)))
    assert.equal(calls.filter(url => url.includes('currently-playing')).length, 1)
    const body = await responses[0].json()
    assert.equal(body.title, 'Song')
    assert.equal(typeof body.observedAt, 'number')
    assert.equal(responses[0].headers.get('Vercel-CDN-Cache-Control'), 'max-age=15')
    assert.deepEqual(await responses[1].json(), body)
    for (let i = 0; i < 2; i++) {
      const history = await GET({ nextUrl: new URL('https://test.invalid/api/spotify?history=1') })
      assert.equal(history.headers.get('Cache-Control'), 'no-store')
      assert.equal(history.headers.get('Vercel-CDN-Cache-Control'), null)
      assert.deepEqual((await history.json()).items, [])
    }
    assert.equal(calls.filter(url => url.includes('recently-played')).length, 2)
    assert.equal(calls.filter(url => url.includes('/api/token')).length, 1)
  })
})

test('Spotify 429 stops fallback endpoint chaining and history respects the same cooldown', async () => {
  const calls = []
  await withSpotify(url => {
    calls.push(url)
    if (url.includes('/api/token')) return json({ access_token: 'token' })
    return new Response(null, { status: 429, headers: { 'Retry-After': '120' } })
  }, async GET => {
    const response = await GET(request)
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Retry-After'), '120')
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    const history = await GET({ nextUrl: new URL('https://test.invalid/api/spotify?history=1') })
    assert.equal(history.status, 429)
    assert.equal(calls.length, 2, 'only token and first playback request reach Spotify')
  })
})

test('private playlist identifiers never enter the public playback cache', async () => {
  await withSpotify(url => {
    if (url.includes('/api/token')) return json({ access_token: 'token' })
    if (url.includes('/playlists/')) return json({ public: false })
    return json({ is_playing: true, item: { id: 'a'.repeat(22), name: 'Song' },
      context: { type: 'playlist', uri: 'spotify:playlist:private-id', external_urls: { spotify: 'https://open.spotify.com/playlist/private-id' } },
    })
  }, async GET => {
    const response = await GET(request)
    const body = await response.json()
    assert.equal(body.contextIsPublic, false)
    assert.equal(body.contextUri, undefined)
    assert.equal(body.contextUrl, undefined)
    assert.equal(JSON.stringify(body).includes('private-id'), false)
  })
})

test('a transient Spotify error is not cached as healthy or retained after recovery', async () => {
  let failed = true
  await withSpotify(url => {
    if (url.includes('/api/token')) return json({ access_token: 'token' })
    return failed ? json({}, 503) : new Response(null, { status: 204 })
  }, async GET => {
    const error = await GET(request)
    assert.equal(error.status, 503)
    assert.equal(error.headers.get('Cache-Control'), 'no-store')
    failed = false
    assert.equal((await GET(request)).status, 200)
  })
})

test('Discord distinguishes offline presence from missing config, failed requests, and invalid responses', async () => {
  const original = process.env.DISCORD_USER_ID
  try {
    for (const [id, upstream, expected] of [
      ['', () => { throw new Error('should not fetch') }, 503],
      ['test', () => json({}, 401), 503],
      ['test', () => json({ success: false }), 503],
      ['test', () => json({ success: true, data: {} }), 503],
      ['test', () => { throw new Error('offline') }, 503],
      ['test', () => json({ success: true, data: { discord_status: 'offline', activities: [] } }), 200],
    ]) {
      process.env.DISCORD_USER_ID = id
      const { GET } = loadTypescript('app/api/discord/route.ts', {
        'next/server': nextServer, '@/lib/rate-limit.mjs': rateLimit,
        '@/lib/ttl-cache.mjs': { createTtlCache },
        '@/lib/provider-monitor.mjs': { monitoredFetch: async () => upstream() },
        '@/lib/discord-activity-store': { recordDiscordGameEstimate: async () => null },
      })
      const response = await GET(request)
      assert.equal(response.status, expected)
      const body = await response.json()
      assert.equal(body.providerStatus, expected === 200 ? 'healthy' : 'unavailable')
      if (expected === 200) assert.equal(body.discord_status, 'offline')
      else assert.equal(body.discord_status, undefined)
    }
  } finally {
    if (original === undefined) delete process.env.DISCORD_USER_ID
    else process.env.DISCORD_USER_ID = original
  }
})

test('Discord records only validated online activity and exposes aggregate estimates', async () => {
  const original = process.env.DISCORD_USER_ID
  process.env.DISCORD_USER_ID = 'test-owner'
  const activities = [{ type: 0, name: 'Game', application_id: '123' }]
  const estimate = { game_time_hours: 2, games_played: 1, tracked_since: '2026-10-23T00:00:00Z' }
  try {
    for (const status of ['online', 'offline']) {
      let recorded
      const { GET } = loadTypescript('app/api/discord/route.ts', {
        'next/server': nextServer, '@/lib/rate-limit.mjs': rateLimit,
        '@/lib/ttl-cache.mjs': { createTtlCache },
        '@/lib/provider-monitor.mjs': { monitoredFetch: async () => json({ success: true, data: { discord_status: status, activities } }) },
        '@/lib/discord-activity-store': { recordDiscordGameEstimate: async (id, games) => { recorded = { id, games }; return estimate } },
      })
      const response = await GET(request)
      const body = await response.json()
      assert.equal(response.status, 200)
      assert.deepEqual(recorded, { id: 'test-owner', games: status === 'online' ? activities : [] })
      assert.deepEqual(body.activity_estimate, estimate)
    }
  } finally {
    if (original === undefined) delete process.env.DISCORD_USER_ID
    else process.env.DISCORD_USER_ID = original
  }
})

function twitchRoute({ token = 'token', config = { clientId: 'client' }, upstream }) {
  return loadTypescript('app/api/twitch/route.ts', {
    'next/server': nextServer, '@/lib/rate-limit.mjs': rateLimit,
    '@/lib/ttl-cache.mjs': { createTtlCache },
    '@/lib/twitch': { getTwitchAccessToken: async () => token, getTwitchConfig: () => config },
    '@/lib/provider-monitor.mjs': { monitoredFetch: async (_provider, url) => upstream(url) },
  })
}

test('Twitch requires valid stream data, reports partial failures, and treats absent schedules as normal', async () => {
  const original = process.env.TWITCH_BROADCASTER_LOGIN
  process.env.TWITCH_BROADCASTER_LOGIN = 'test'
  try {
    for (const [options, expected, state] of [
      [{ token: null }, 503, 'unavailable'],
      [{ config: null }, 503, 'unavailable'],
      [{ failure: '/users' }, 503, 'unavailable'],
      [{ failure: '/streams' }, 503, 'unavailable'],
      [{ failure: '/subscriptions' }, 200, 'degraded'],
      [{ failure: '/schedule', failureStatus: 404 }, 200, 'healthy'],
      [{}, 200, 'healthy'],
    ]) {
      const { GET } = twitchRoute({ ...options, upstream: (url) => {
        if (options.failure && url.includes(options.failure)) return json({}, options.failureStatus ?? 401)
        if (url.includes('/users')) return json({ data: [{ id: '1', login: 'test', display_name: 'Test' }] })
        if (url.includes('/streams')) return json({ data: [] })
        if (url.includes('/schedule')) return json({ data: { segments: [] } })
        return json({ total: 0 })
      } })
      const response = await GET(request)
      assert.equal(response.status, expected)
      assert.equal((await response.json()).providerStatus, state)
      if (expected === 503) assert.equal(response.headers.get('Cache-Control'), 'no-store')
    }
  } finally {
    if (original === undefined) delete process.env.TWITCH_BROADCASTER_LOGIN
    else process.env.TWITCH_BROADCASTER_LOGIN = original
  }
})

test('Spotify reports idle as healthy and authentication/upstream errors as unavailable', async () => {
  const values = { SPOTIFY_CLIENT_ID: 'client', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh', DISCORD_USER_ID: 'test' }
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  Object.assign(process.env, values)
  try {
    for (const [mode, expected, state] of [['idle', 200, 'healthy'], ['token', 503, 'unavailable'], ['upstream', 503, 'unavailable'], ['history', 503, 'unavailable']]) {
      const { GET } = loadTypescript('app/api/spotify/route.ts', {
        'next/server': nextServer, '@/lib/rate-limit.mjs': rateLimit,
        '@/lib/ttl-cache.mjs': { createTtlCache },
        '@/lib/spotify-fetch.mjs': { createSpotifyFetcher, SpotifyCooldownError },
        '@/lib/provider-monitor.mjs': { monitoredFetch: async (_provider, url) => {
          if (url.includes('/api/token')) return mode === 'token' ? json({}, 401) : json({ access_token: 'token' })
          if (mode === 'idle') return new Response(null, { status: 204 })
          return json({}, 500)
        } },
      })
      const response = await GET({ nextUrl: new URL(`https://test.invalid/api/spotify${mode === 'history' ? '?history=1' : ''}`) })
      assert.equal(response.status, expected, mode)
      const body = await response.json()
      assert.equal(body.providerStatus, state, mode)
      if (mode === 'idle') assert.equal(body.isPlaying, false)
    }
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})


test('Discord normalizes malformed activity payloads before displaying or recording them', async () => {
  const original = process.env.DISCORD_USER_ID
  process.env.DISCORD_USER_ID = 'test-owner'
  const valid = { type: 0, name: 'Game', application_id: '123' }
  try {
    for (const activities of [{ bad: true }, [null, {}, { type: '0', name: 'Bad' }, { type: 9, name: 'Bad' }, valid]]) {
      let recorded
      const { GET } = loadTypescript('app/api/discord/route.ts', {
        'next/server': nextServer, '@/lib/rate-limit.mjs': rateLimit,
        '@/lib/ttl-cache.mjs': { createTtlCache },
        '@/lib/provider-monitor.mjs': { monitoredFetch: async () => json({ success: true, data: { discord_status: 'online', activities } }) },
        '@/lib/discord-activity-store': { recordDiscordGameEstimate: async (_id, games) => { recorded = games; return null } },
      })
      const response = await GET(request)
      const body = await response.json()
      const expected = Array.isArray(activities) ? [valid] : []
      assert.equal(response.status, 200)
      assert.deepEqual(body.activities, expected)
      assert.deepEqual(recorded, expected)
    }
  } finally {
    if (original === undefined) delete process.env.DISCORD_USER_ID
    else process.env.DISCORD_USER_ID = original
  }
})
