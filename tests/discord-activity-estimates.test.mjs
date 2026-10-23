import assert from 'node:assert/strict'
import test from 'node:test'
import { observeDiscordGames, persistDiscordGameEstimate, MAX_SESSION_BACKFILL_MS } from '../lib/discord-activity-estimates.mjs'
import { loadTypescript } from './load-typescript.mjs'
import { createTtlCache } from '../lib/ttl-cache.mjs'

const now = Date.parse('2026-10-23T12:00:00Z')
const game = (id = '123', start = now - 3_600_000) => ({ type: 0, name: 'Game', application_id: id, timestamps: { start } })

test('ongoing sessions backfill elapsed hours once and subsequent polls add only new time', () => {
  const first = observeDiscordGames(null, [game()], now)
  assert.equal(first.gameTimeMs, 3_600_000)
  const second = observeDiscordGames(first, [game()], now + 20_000)
  assert.equal(second.gameTimeMs, 3_620_000)
  assert.equal(second.games.length, 1)
  assert.equal(observeDiscordGames(second, [game()], now), second)
})

test('overlapping games count wall time once, while distinct application IDs count separately', () => {
  const state = observeDiscordGames(null, [game('123'), game('456', now - 1_800_000), { ...game('123'), name: 'Another Roblox experience' }], now)
  assert.equal(state.gameTimeMs, 3_600_000)
  assert.equal(state.games.length, 2)
  assert.equal(observeDiscordGames(state, [], now + 20_000).gameTimeMs, state.gameTimeMs)
})

test('untimed games count only consecutive observations and never bridge long unseen gaps', () => {
  const untimed = { type: 0, name: 'Untimed game' }
  const first = observeDiscordGames(null, [untimed], now)
  assert.equal(first.gameTimeMs, 0)
  const next = observeDiscordGames(first, [untimed], now + 20_000)
  assert.equal(next.gameTimeMs, 20_000)
  const gap = observeDiscordGames(next, [untimed], now + 3_600_000)
  assert.equal(gap.gameTimeMs, 20_000)
  const offline = observeDiscordGames(gap, [], now + 3_610_000)
  assert.equal(observeDiscordGames(offline, [untimed], now + 3_620_000).gameTimeMs, 20_000)
})

test('non-playing activities do not count and ancient/future timestamps are bounded', () => {
  const state = observeDiscordGames(null, [{ type: 1, name: 'Twitch' }, { type: 2, name: 'Spotify' }, null, { type: 0 }], now)
  assert.equal(state.gameTimeMs, 0)
  assert.equal(state.games.length, 0)
  assert.equal(observeDiscordGames(null, [game('123', now - 7 * MAX_SESSION_BACKFILL_MS)], now).gameTimeMs, MAX_SESSION_BACKFILL_MS)
  assert.equal(observeDiscordGames(null, [game('123', now + 1000)], now).gameTimeMs, 0)
})

function database(initial = null, fail = false, legacy = null) {
  const currentId = 'discord_activity_estimates:v2:owner'
  const legacyId = 'discord_activity_estimates:owner'
  const rows = new Map()
  if (initial) rows.set(currentId, structuredClone(initial))
  if (legacy) rows.set(legacyId, structuredClone(legacy))
  const client = { from: () => {
    let operation = 'read', value, expectedRevision, id
    const query = {
      select: () => query,
      eq: (column, filter) => { if (column === 'value->>revision') expectedRevision = filter; if (column === 'id') id = filter; return query },
      update: (payload) => { operation = 'update'; value = payload.value; return query },
      insert: (payload) => ({ abortSignal: async () => {
        await Promise.resolve()
        if (fail) return { error: { code: 'unavailable' } }
        if (rows.has(payload.id)) return { error: { code: '23505' } }
        rows.set(payload.id, structuredClone(payload.value))
        return { error: null }
      } }),
      abortSignal: () => query,
      maybeSingle: async () => {
        if (fail) return { error: { code: 'unavailable' }, data: null }
        if (operation === 'read') {
          const stored = rows.get(id)
          const snapshot = stored ? { value: structuredClone(stored) } : null
          await Promise.resolve()
          return { data: snapshot, error: null }
        }
        await Promise.resolve()
        if (rows.get(id)?.revision !== expectedRevision) return { data: null, error: null }
        rows.set(id, structuredClone(value))
        return { data: { id }, error: null }
      },
    }
    return query
  } }
  return { client, read: (id = currentId) => rows.get(id), writeLegacy: value => rows.set(legacyId, structuredClone(value)) }
}

test('concurrent requests and fresh server instances persist one shared total', async () => {
  const db = database()
  const results = await Promise.all(Array.from({ length: 5 }, () => persistDiscordGameEstimate(db.client, 'owner', [game()], now)))
  assert.ok(results.every(result => result.game_time_hours === 1))
  assert.equal(db.read().gameTimeMs, 3_600_000)
  const freshServer = await persistDiscordGameEstimate(db.client, 'owner', [game()], now + 20_000)
  assert.equal(freshServer.game_time_hours, 3_620_000 / 3_600_000)
  assert.equal(freshServer.games_played, 1)
  assert.equal('games' in freshServer, false)
})

test('storage failures and corrupt data do not report fabricated persisted totals', async () => {
  assert.equal(await persistDiscordGameEstimate(null, 'owner', [game()], now), null)
  await assert.rejects(persistDiscordGameEstimate(database(null, true).client, 'owner', [game()], now))
  await assert.rejects(persistDiscordGameEstimate(database({ gameTimeMs: -1 }).client, 'owner', [game()], now))
  const { recordDiscordGameEstimate } = loadTypescript('lib/discord-activity-store.ts', {
    './discord-achievements': { DISCORD_BADGE_DEFAULTS: { discord_game_time_baseline_at: '2026-10-23T09:54:43Z' } },
    './supabase-server': { getSupabase: () => ({}) }, './ttl-cache.mjs': { createTtlCache },
    './discord-activity-estimates.mjs': { persistDiscordGameEstimate: async () => { throw new Error('Storage offline') } },
  })
  assert.equal(await recordDiscordGameEstimate('owner', [game()]), null)
})


test('a confirmed snapshot replaces prior estimated hours without backfilling time already covered by the snapshot', () => {
  // An older deployment may first observe the account after the snapshot date,
  // but its backfilled hours still predate the snapshot and must be replaced.
  const previous = observeDiscordGames(null, [game()], now + 60_000)
  const cutoff = now + 30_000
  const recalibrated = observeDiscordGames(previous, [game()], cutoff + 20_000, cutoff)
  assert.equal(recalibrated.gameTimeMs, 20_000)
  assert.deepEqual(recalibrated.games, previous.games)
  assert.equal(previous.gameTimeMs, 3_660_000)
  const next = observeDiscordGames(recalibrated, [game()], cutoff + 40_000, cutoff)
  assert.equal(next.gameTimeMs, 40_000)
  assert.equal(observeDiscordGames(null, [game()], cutoff + 20_000, cutoff).gameTimeMs, 20_000)
})

test('concurrent recalibration preserves the confirmed snapshot boundary across server instances', async () => {
  const previous = { ...observeDiscordGames(null, [game()], now), revision: 'old-snapshot' }
  const db = database(previous)
  const cutoff = now + 30_000
  const results = await Promise.all(Array.from({ length: 5 }, () => persistDiscordGameEstimate(db.client, 'owner', [game()], cutoff + 20_000, undefined, cutoff)))
  assert.ok(results.every(result => result.game_time_hours === 20_000 / 3_600_000))
  assert.equal(db.read().gameTimeMs, 20_000)
  assert.equal(db.read().games.length, 1)
})


test('offline and empty observations prevent later timestamps from recounting the observed gap', () => {
  const first = observeDiscordGames(null, [game()], now)
  const offline = observeDiscordGames(first, [], now + 3_600_000)
  const resumed = observeDiscordGames(offline, [game()], now + 7_200_000)
  assert.equal(first.gameTimeMs, 3_600_000)
  assert.equal(offline.gameTimeMs, first.gameTimeMs)
  assert.equal(resumed.gameTimeMs, 7_200_000)
  const firstEmpty = observeDiscordGames(null, [], now)
  assert.equal(observeDiscordGames(firstEmpty, [game()], now + 20_000).gameTimeMs, 20_000)
})

test('older snapshot requests cannot reset or rewrite a newer saved period', async () => {
  const cutoff = now - 1_800_000
  const saved = { ...observeDiscordGames(null, [game()], now, cutoff), revision: 'new-snapshot' }
  const db = database(saved)
  const totals = await persistDiscordGameEstimate(db.client, 'owner', [game()], now + 20_000, undefined, 0)
  assert.equal(totals.game_time_hours, 0.5)
  assert.deepEqual(db.read(), saved)
})

test('legacy preview counters import once and subsequent legacy writes cannot affect current totals', async () => {
  const legacy = { ...observeDiscordGames(null, [game()], now), revision: 'legacy' }
  const db = database(null, false, legacy)
  const imported = await persistDiscordGameEstimate(db.client, 'owner', [game()], now + 20_000)
  assert.equal(imported.game_time_hours, 3_620_000 / 3_600_000)
  assert.deepEqual(db.read('discord_activity_estimates:owner'), legacy)
  db.writeLegacy({ ...legacy, gameTimeMs: 100 * 3_600_000, revision: 'old-tab' })
  const current = await persistDiscordGameEstimate(db.client, 'owner', [game()], now + 40_000)
  assert.equal(current.game_time_hours, 3_640_000 / 3_600_000)
  assert.equal(db.read().games.length, 1)
})


test('a future snapshot boundary never credits time before that boundary', () => {
  const cutoff = now + 3_600_000
  const first = observeDiscordGames(null, [game()], now, cutoff)
  const next = observeDiscordGames(first, [game()], now + 20_000, cutoff)
  assert.equal(next.gameTimeMs, 0)
  const after = observeDiscordGames(next, [game()], cutoff + 20_000, cutoff)
  assert.equal(after.gameTimeMs, 20_000)
})
