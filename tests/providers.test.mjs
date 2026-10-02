import assert from 'node:assert/strict'
import test from 'node:test'
import { createTtlCache } from '../lib/ttl-cache.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const rateLimit = { limitPublicRequest: () => ({ allowed: true }) }
const request = { nextUrl: new URL('https://test.invalid/api/spotify') }
const json = (body, status = 200) => Response.json(body, { status })

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

test('Spotify reports idle as healthy, authentication/upstream errors as unavailable, and Discord fallback as degraded', async () => {
  const values = { SPOTIFY_CLIENT_ID: 'client', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh', DISCORD_USER_ID: 'test' }
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  Object.assign(process.env, values)
  try {
    for (const [mode, expected, state] of [['idle', 200, 'healthy'], ['token', 503, 'unavailable'], ['upstream', 503, 'unavailable'], ['fallback', 200, 'degraded'], ['history', 503, 'unavailable']]) {
      const { GET } = loadTypescript('app/api/spotify/route.ts', {
        'next/server': nextServer, '@/lib/rate-limit.mjs': rateLimit,
        '@/lib/ttl-cache.mjs': { createTtlCache },
        '@/lib/provider-monitor.mjs': { monitoredFetch: async (_provider, url) => {
          if (url.includes('/api/token')) return mode === 'token' ? json({}, 401) : json({ access_token: 'token' })
          if (url.includes('lanyard')) return json({ success: true, data: { activities: mode === 'fallback' ? [{ type: 2, name: 'Spotify', details: 'Track' }] : [] } })
          if (mode === 'idle') return new Response(null, { status: 204 })
          return json({}, 500)
        } },
      })
      const response = await GET({ nextUrl: new URL(`https://test.invalid/api/spotify${mode === 'history' ? '?history=1' : ''}`) })
      assert.equal(response.status, expected, mode)
      const body = await response.json()
      assert.equal(body.providerStatus, state, mode)
      if (mode === 'idle') assert.equal(body.isPlaying, false)
      if (mode === 'fallback') assert.equal(body.isPlaying, true)
    }
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
