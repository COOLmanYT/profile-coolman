import assert from 'node:assert/strict'
import test from 'node:test'
import { DISCORD_BADGE_DEFAULTS, DISCORD_BADGE_ORDER, getDiscordAchievementBadges, getDiscordMembershipBadges, getDiscordMembershipMonths, orderDiscordBadges } from '../lib/discord-achievements.ts'

import { observeDiscordGames, gameEstimateTotals } from '../lib/discord-activity-estimates.mjs'

const snowflakeAt = (date) => String(BigInt(Date.parse(date) - 1420070400000) << 22n)
const createdAt = '2020-06-15T12:30:00.000Z'
const id = snowflakeAt(createdAt)
const now = Date.parse('2026-10-23T00:00:00.000Z')

test('the configured 8 November 2025 creation date takes precedence over a different account ID', () => {
  assert.deepEqual(getDiscordAchievementBadges(id, DISCORD_BADGE_DEFAULTS, now).map(badge => badge.key), ['last-meadow'])
  assert.deepEqual(getDiscordAchievementBadges(id, DISCORD_BADGE_DEFAULTS, Date.parse('2026-11-07T23:59:59.999Z')).map(badge => badge.key), ['last-meadow'])
  const badges = getDiscordAchievementBadges(id, DISCORD_BADGE_DEFAULTS, Date.parse('2026-11-08T00:00:00.000Z'))
  assert.equal(badges[0].label, 'Account Age: Seed')
  assert.equal(badges[0].details, '1 year on Discord')
})

test('manual totals work without Lanyard setup and live KV can override or hide them', () => {
  const manual = { ...DISCORD_BADGE_DEFAULTS, discord_game_time_hours: 75, discord_games_played: 10, discord_streaming_hours: 5 }
  assert.deepEqual(getDiscordAchievementBadges(id, manual, now).map((badge) => badge.label), [
    'Game Time: Committed', 'Game Variety: Enthusiast', 'Streaming: Fledgling', 'Last Meadow Online',
  ])
  const liveKv = { discord_game_time_hours: '300', discord_games_played: '0', discord_streaming_hours: 'invalid' }
  assert.deepEqual(getDiscordAchievementBadges(id, { ...manual, ...liveKv }, now).map((badge) => badge.label), ['Game Time: Devoted', 'Last Meadow Online'])
})

test('badge ordering follows the supplied profile and keeps unknown badges stable at the end', () => {
  const expected = ['nitro', 'legend-gifting', 'quest', 'booster', 'hypesquad-brilliance', 'account-age', 'streaming', 'game-variety', 'game-time', 'last-meadow', 'orbs']
  assert.deepEqual(DISCORD_BADGE_ORDER, expected)
  const badges = [...expected].reverse().map(key => ({ key }))
  badges.push({ key: 'other-1' }, { key: 'other-2' })
  const sorted = orderDiscordBadges(badges)
  assert.deepEqual(sorted.map(badge => badge.key), [...expected, 'other-1', 'other-2'])
  assert.equal(badges[0].key, 'orbs')
})

test('estimated playing totals select tiers, label estimates, and yield to manual overrides', () => {
  const estimate = { game_time_hours: 19, games_played: 5, tracked_since: new Date(now).toISOString() }
  const badges = getDiscordAchievementBadges(undefined, { discord_game_time_baseline_hours: 1 }, now, estimate)
  assert.deepEqual(badges.map(badge => badge.label), ['Game Time: Dedicated', 'Game Variety: Dabbler'])
  assert.equal(badges[0].details, 'Estimated · 20 hours played')
  const manual = getDiscordAchievementBadges(undefined, { discord_game_time_hours: 75, discord_games_played: 0 }, now, estimate)
  assert.deepEqual(manual.map(badge => badge.label), ['Game Time: Committed'])
  assert.equal(manual[0].details, '75 hours played')
  assert.deepEqual(getDiscordAchievementBadges(undefined, { discord_game_time_hours: 'bad', discord_games_played: 0 }, now, estimate), [])
})

test('invalid configured creation dates fall back to the account ID, and future dates stay locked', () => {
  for (const date of ['2025-02-30', '2025-13-01', '08/11/2025', '2025-11-08junk', '', null]) {
    assert.equal(getDiscordAchievementBadges(id, { discord_account_created_at: date }, now)[0].label, 'Account Age: Redwood')
  }
  assert.deepEqual(getDiscordAchievementBadges(id, { discord_account_created_at: '2030-11-08' }, now), [])
})

test('Account Age advances on the UTC anniversary and caps its artwork at ten years', () => {
  assert.equal(getDiscordAchievementBadges(id, {}, Date.parse('2021-06-15T12:29:59.999Z')).length, 0)
  assert.equal(getDiscordAchievementBadges(id, {}, Date.parse('2021-06-15T12:30:00.000Z'))[0].label, 'Account Age: Seed')
  assert.equal(getDiscordAchievementBadges(id, {}, now)[0].label, 'Account Age: Redwood')
  const oldest = getDiscordAchievementBadges(id, {}, Date.parse('2032-06-15T12:30:00.000Z'))[0]
  assert.equal(oldest.label, 'Account Age: Primordial')
  assert.equal(oldest.details, '12 years on Discord')
})

test('missing, malformed, out-of-range, or future account IDs do not invent an age badge', () => {
  for (const value of [undefined, '', 'invalid', '123', '-12345678901234567', '99999999999999999999', snowflakeAt('2030-01-01')]) {
    assert.deepEqual(getDiscordAchievementBadges(value, {}, now), [])
  }
  assert.deepEqual(getDiscordAchievementBadges(id, { discord_account_age_badge: 'false' }, now), [])
  assert.deepEqual(getDiscordAchievementBadges(id, { discord_account_age_badge: false }, now), [])
})

test('activity badges require supplied historical totals and respect unlock boundaries', () => {
  const totals = { discord_game_time_hours: '0.99', discord_games_played: '1', discord_streaming_hours: '0' }
  assert.deepEqual(getDiscordAchievementBadges(undefined, totals, now), [])
  const badges = getDiscordAchievementBadges(undefined, {
    discord_game_time_hours: '1', discord_games_played: '2', discord_streaming_hours: '1',
  }, now)
  assert.deepEqual(badges.map((badge) => badge.label), ['Game Time: Casual', 'Game Variety: Sampler', 'Streaming: Newcomer'])
  assert.equal(badges[0].details, '1 hour played')
})

test('all activity milestones upgrade at the boundary and retain the final tier above the cap', () => {
  const families = [
    ['discord_game_time_hours', [1, 5, 20, 75, 150, 300, 500, 1000, 2000, 5000], 'Game Time: Eternal'],
    ['discord_streaming_hours', [1, 5, 20, 75, 150, 300, 500, 1000, 2000, 5000], 'Streaming: Phenomenon'],
    ['discord_games_played', [2, 5, 10, 15, 20, 30, 40, 60, 80, 100], 'Game Variety: Universalist'],
  ]
  for (const [key, milestones, finalLabel] of families) {
    let previousIcon
    for (const milestone of milestones) {
      const below = getDiscordAchievementBadges(undefined, { [key]: milestone - 1 }, now)[0]
      assert.equal(below?.iconUrl, previousIcon)
      const badge = getDiscordAchievementBadges(undefined, { [key]: milestone }, now)[0]
      assert.ok(badge)
      assert.notEqual(badge.iconUrl, previousIcon)
      assert.match(badge.iconUrl, /^https:\/\/cdn\.discordapp\.com\/assets\/content\/[a-f0-9]{64}\.svg$/)
      previousIcon = badge.iconUrl
    }
    assert.equal(getDiscordAchievementBadges(undefined, { [key]: 100000 }, now)[0].label, finalLabel)
  }
})

test('invalid progress is omitted independently and game counts must be whole numbers', () => {
  for (const value of [null, {}, [], true, '', ' ', 'NaN', 'Infinity', '-1', -1, Infinity, '1e3', '0x10']) {
    assert.deepEqual(getDiscordAchievementBadges(undefined, { discord_game_time_hours: value }, now), [])
  }
  const badges = getDiscordAchievementBadges(undefined, {
    discord_game_time_hours: '75.5', discord_games_played: '2.5', discord_streaming_hours: 'bad',
  }, now)
  assert.deepEqual(badges.map((badge) => badge.label), ['Game Time: Committed'])
})


test('Nitro and Booster artwork evolves exactly at every calendar milestone', () => {
  const start = '2025-01-26T12:30:00.000Z'
  for (const [key, milestones] of [
    ['nitro', [3, 6, 12, 24, 36, 60, 72]],
    ['booster', [2, 3, 6, 9, 12, 15, 18, 24]],
  ]) {
    let previousIcon = getDiscordMembershipBadges({ premium_since: start, premium_guild_since: start }, {}, Date.parse(start)).find(b => b.key === key).iconUrl
    for (const months of milestones) {
      const boundary = new Date(start)
      boundary.setUTCMonth(boundary.getUTCMonth() + months)
      const before = getDiscordMembershipBadges({ premium_since: start, premium_guild_since: start }, {}, boundary.getTime() - 1).find(b => b.key === key)
      const after = getDiscordMembershipBadges({ premium_since: start, premium_guild_since: start }, {}, boundary.getTime()).find(b => b.key === key)
      assert.equal(before.iconUrl, previousIcon)
      assert.notEqual(after.iconUrl, before.iconUrl)
      previousIcon = after.iconUrl
    }
  }
  const firstYear = getDiscordMembershipBadges({ premium_since: start }, {}, Date.parse('2026-01-26T12:30:00Z'))[0]
  assert.equal(firstYear.label, 'Nitro 1 Year')
  assert.match(firstYear.iconUrl, /platinum.svg$/)
})

test('calendar progression handles short months, leap days, invalid dates, and manual streak resets', () => {
  assert.equal(getDiscordMembershipMonths('2025-01-31T12:00:00Z', Date.parse('2025-02-28T11:59:59.999Z')), 0)
  assert.equal(getDiscordMembershipMonths('2025-01-31T12:00:00Z', Date.parse('2025-02-28T12:00:00Z')), 1)
  assert.equal(getDiscordMembershipMonths('2024-02-29T12:00:00Z', Date.parse('2025-02-28T12:00:00Z')), 12)
  assert.equal(getDiscordMembershipMonths('bad', now), undefined)
  assert.equal(getDiscordMembershipMonths('2030-01-01', now), undefined)
  assert.deepEqual(getDiscordMembershipBadges({}, { discord_nitro_badge: 'false', discord_booster_badge: false }, now), [])
  const reset = getDiscordMembershipBadges({}, { discord_nitro_started_at: '2026-10-23T00:00:00Z' }, now)[0]
  assert.match(reset.iconUrl, /bronze.svg$/)
  assert.equal(reset.label, 'Nitro 0 Months')
  const upstream = getDiscordMembershipBadges({ premium_since: '2025-10-23T00:00:00Z' }, { discord_nitro_started_at: '2026-10-23T00:00:00Z' }, now)[0]
  assert.match(upstream.iconUrl, /platinum.svg$/)
})

test('an observed session crossing a playtime milestone changes the badge icon without losing profile order', () => {
  const activity = [{ type: 0, name: 'Game A', application_id: '123', timestamps: { start: now - 3_600_000 + 1 } }]
  const beforeState = observeDiscordGames(null, activity, now)
  const afterState = observeDiscordGames(beforeState, activity, now + 1)
  const before = getDiscordAchievementBadges(undefined, {}, now, gameEstimateTotals(beforeState))
  const after = getDiscordAchievementBadges(undefined, {}, now + 1, gameEstimateTotals(afterState))
  assert.equal(before.length, 0)
  assert.equal(after[0].label, 'Game Time: Casual')
  const upgradedState = observeDiscordGames(afterState, activity, now + 4 * 3_600_000 + 1)
  const upgraded = getDiscordAchievementBadges(undefined, {}, now, gameEstimateTotals(upgradedState))
  assert.equal(upgraded[0].label, 'Game Time: Recreational')
  assert.notEqual(upgraded[0].iconUrl, after[0].iconUrl)
  const nextGame = observeDiscordGames(upgradedState, [{ type: 0, name: 'Game B', application_id: '456' }], now + 4 * 3_600_000 + 2)
  const ordered = orderDiscordBadges(getDiscordAchievementBadges(undefined, {}, now, gameEstimateTotals(nextGame)))
  assert.deepEqual(ordered.map(b => b.key), ['game-variety', 'game-time'])
})
