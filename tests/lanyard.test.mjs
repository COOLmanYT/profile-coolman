import assert from 'node:assert/strict'
import test from 'node:test'
import { createLanyardStore } from '../lib/lanyard-client.mjs'
import { lanyardTrack } from '../lib/spotify-presence.mjs'
import { createSpotifyFetcher, SpotifyCooldownError } from '../lib/spotify-fetch.mjs'

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const presence = (track = 'a'.repeat(22)) => ({
  userId: '123', discord_status: 'online', activities: [],
  listening_to_spotify: true,
  spotify: { track_id: track, song: track, artist: 'First; Second', timestamps: { start: 1000, end: 101_000 } },
})

function environment(fetcher = async () => presence()) {
  let time = 2000, id = 0, requests = 0
  const jobs = new Map(), sockets = [], listeners = new Set()
  const visibility = { hidden: false, addEventListener: (_, f) => listeners.add(f), removeEventListener: (_, f) => listeners.delete(f) }
  const timers = {
    setTimeout: (f, delay) => { jobs.set(++id, { f, at: time + delay, delay }); return id },
    clearTimeout: key => jobs.delete(key),
  }
  const store = createLanyardStore({
    visibility, timers, now: () => time, random: () => 0.5,
    fetchPresence: signal => { requests++; return fetcher(signal) },
    socketFactory: url => {
      assert.equal(url, 'wss://api.lanyard.rest/socket')
      const socket = { readyState: 1, sent: [], send: value => socket.sent.push(JSON.parse(value)), close: () => { socket.closed = true } }
      sockets.push(socket)
      return socket
    },
  })
  return {
    store, jobs, sockets, visibility, listeners,
    get requests() { return requests },
    message(message, socket = sockets.at(-1)) { socket.onmessage({ data: JSON.stringify(message) }) },
    hide(hidden) { visibility.hidden = hidden; for (const listener of listeners) listener() },
    async advance(ms) {
      const end = time + ms
      while (true) {
        const entry = [...jobs.entries()].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!entry) break
        const [key, job] = entry
        jobs.delete(key); time = job.at; job.f(); await settle()
      }
      time = end
    },
  }
}

test('both widgets share one bootstrap/socket, handle heartbeats, and clean up on final unsubscribe', async () => {
  const env = environment()
  const stopA = env.store.subscribe(() => {})
  const stopB = env.store.subscribe(() => {})
  await settle()
  assert.equal(env.requests, 1)
  assert.equal(env.sockets.length, 1)
  env.message({ op: 1, d: { heartbeat_interval: 10_000 } })
  assert.deepEqual(env.sockets[0].sent, [{ op: 2, d: { subscribe_to_id: '123' } }])
  env.message({ op: 0, t: 'INIT_STATE', d: presence() })
  await env.advance(10_000)
  assert.deepEqual(env.sockets[0].sent.at(-1), { op: 3 })
  stopA()
  assert.equal(env.sockets[0].closed, undefined)
  stopB()
  assert.equal(env.sockets[0].closed, true)
  assert.equal(env.jobs.size, 0)
  assert.equal(env.listeners.size, 0)
})

test('new songs update immediately and expire even after REST metadata refreshes', async () => {
  const env = environment()
  const stop = env.store.subscribe(() => {})
  await settle()
  env.message({ op: 0, t: 'INIT_STATE', d: presence() })
  env.message({ op: 0, t: 'PRESENCE_UPDATE', d: presence('b'.repeat(22)) })
  assert.equal(env.store.getSnapshot().presence.spotify.track_id, 'b'.repeat(22))
  await env.advance(60_000)
  assert.equal(env.requests, 2)
  assert.equal(env.store.getSnapshot().presence.spotify.track_id, 'b'.repeat(22), 'older REST must not overwrite live song')
  await env.advance(39_000)
  assert.equal(env.store.getSnapshot().presence.listening_to_spotify, false)
  stop()
})

test('socket failures back off without a REST request per retry and discard stale playback', async () => {
  const env = environment()
  const stop = env.store.subscribe(() => {})
  await settle()
  env.message({ op: 0, t: 'INIT_STATE', d: presence() })
  env.sockets[0].onclose()
  assert.equal(env.store.getSnapshot().presence, null)
  await env.advance(1000)
  assert.equal(env.sockets.length, 2)
  env.sockets[1].onclose()
  await env.advance(1999)
  assert.equal(env.sockets.length, 2)
  await env.advance(1)
  assert.equal(env.sockets.length, 3)
  assert.equal(env.requests, 1)
  stop()
})

test('hidden pages stop all network work and late cancelled bootstrap responses are ignored', async () => {
  let finish
  const env = environment(() => new Promise(resolve => { finish = resolve }))
  const stop = env.store.subscribe(() => {})
  env.hide(true)
  finish(presence())
  await settle()
  await env.advance(120_000)
  assert.equal(env.requests, 1)
  assert.equal(env.sockets.length, 0)
  assert.equal(env.jobs.size, 0)
  env.hide(false)
  finish(presence())
  await settle()
  assert.equal(env.requests, 2)
  assert.equal(env.sockets.length, 1)
  stop()
})

test('stalled or malformed connections retry and invalid activities cannot break widgets', async () => {
  const env = environment()
  const stop = env.store.subscribe(() => {})
  await settle()
  await env.advance(15_000)
  assert.equal(env.sockets[0].closed, true)
  await env.advance(1000)
  env.message({ op: 0, t: 'INIT_STATE', d: { ...presence(), activities: [null, {}, { type: 0, name: 'Game' }] } })
  assert.deepEqual(env.store.getSnapshot().presence.activities, [{ type: 0, name: 'Game' }])
  env.message({ op: 1, d: { heartbeat_interval: -1 } })
  assert.equal(env.sockets[1].closed, true)
  stop()
})

test('structured Spotify data provides real track links, split artists and local progress; expired data is rejected', () => {
  const track = lanyardTrack(presence(), 2000)
  assert.equal(track.progressMs, 1000)
  assert.equal(track.durationMs, 100_000)
  assert.deepEqual(track.artists, ['First', 'Second'])
  assert.equal(track.songUrl, `https://open.spotify.com/track/${'a'.repeat(22)}`)
  assert.equal(lanyardTrack(presence(), 101_000), null)
  assert.equal(lanyardTrack({ ...presence(), listening_to_spotify: false }, 2000), null)
  assert.equal(lanyardTrack({ ...presence(), spotify: { ...presence().spotify, track_id: '../../bad' } }, 2000), null)
})

test('Spotify cooldown applies across endpoints and permits recovery only after Retry-After', async () => {
  let time = 1000, calls = 0
  const fetcher = createSpotifyFetcher(async () => {
    calls++
    return calls === 1 ? new Response(null, { status: 429, headers: { 'Retry-After': '120' } }) : Response.json({})
  }, () => time)
  await assert.rejects(fetcher('/currently-playing'), SpotifyCooldownError)
  time += 1000
  await assert.rejects(fetcher('/history'), error => error.retryAfterSeconds === 119)
  assert.equal(calls, 1)
  time += 119_000
  assert.equal((await fetcher('/currently-playing')).status, 200)
  assert.equal(calls, 2)
})
