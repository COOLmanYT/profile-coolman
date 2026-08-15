import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SEASONAL_SETTINGS,
  automaticThemeAt,
  isAustralia,
  isSeasonalTheme,
  isThemeLocation,
  normaliseSeasonalSettings,
  resolveGlobalTheme,
} from '../lib/seasonal.ts'

test('isSeasonalTheme accepts known themes and rejects everything else', () => {
  for (const theme of ['christmas', 'halloween', 'easter', 'new-year', 'birthday']) {
    assert.equal(isSeasonalTheme(theme), true)
  }
  assert.equal(isSeasonalTheme('summer'), false)
  assert.equal(isSeasonalTheme(null), false)
  assert.equal(isSeasonalTheme(42), false)
})

test('isThemeLocation accepts the three allowed locations', () => {
  assert.equal(isThemeLocation('anywhere'), true)
  assert.equal(isThemeLocation('australia'), true)
  assert.equal(isThemeLocation('outside-australia'), true)
  assert.equal(isThemeLocation('moon'), false)
})

test('isAustralia matches Australian time zones only', () => {
  assert.equal(isAustralia('Australia/Sydney'), true)
  assert.equal(isAustralia('Australia/Perth'), true)
  assert.equal(isAustralia('Europe/London'), false)
  assert.equal(isAustralia('Pacific/Auckland'), false)
})

test('automaticThemeAt returns new-year on 1 January in any time zone', () => {
  assert.equal(automaticThemeAt(new Date('2026-01-01T00:00:00Z'), 'UTC'), 'new-year')
  // Same instant is already 1 January in Sydney (UTC+11).
  assert.equal(automaticThemeAt(new Date('2026-01-01T00:00:00Z'), 'Australia/Sydney'), 'new-year')
})

test('automaticThemeAt activates the New Year countdown in the final 10 seconds of the year', () => {
  assert.equal(automaticThemeAt(new Date('2026-12-31T23:59:50Z'), 'UTC'), 'new-year')
  assert.equal(automaticThemeAt(new Date('2026-12-31T23:59:59Z'), 'UTC'), 'new-year')
  // One second earlier (and the rest of 31 Dec) is not yet New Year.
  assert.equal(automaticThemeAt(new Date('2026-12-31T23:59:49Z'), 'UTC'), null)
})

test('automaticThemeAt returns christmas across the 22-28 December window', () => {
  assert.equal(automaticThemeAt(new Date('2026-12-22T00:00:00Z'), 'UTC'), 'christmas')
  assert.equal(automaticThemeAt(new Date('2026-12-28T23:59:59Z'), 'UTC'), 'christmas')
  assert.equal(automaticThemeAt(new Date('2026-12-21T23:59:59Z'), 'UTC'), null)
  assert.equal(automaticThemeAt(new Date('2026-12-29T00:00:00Z'), 'UTC'), null)
})

test('automaticThemeAt returns halloween on 31 October and birthday on 28 November', () => {
  assert.equal(automaticThemeAt(new Date('2026-10-31T12:00:00Z'), 'UTC'), 'halloween')
  assert.equal(automaticThemeAt(new Date('2026-10-30T12:00:00Z'), 'UTC'), null)
  assert.equal(automaticThemeAt(new Date('2026-11-28T12:00:00Z'), 'UTC'), 'birthday')
  assert.equal(automaticThemeAt(new Date('2026-11-27T12:00:00Z'), 'UTC'), null)
})

test('automaticThemeAt resolves Easter Sunday and the surrounding -2/+1 day window', () => {
  // Easter Sunday 2024 fell on 31 March.
  assert.equal(automaticThemeAt(new Date('2024-03-31T12:00:00Z'), 'UTC'), 'easter')
  assert.equal(automaticThemeAt(new Date('2024-03-29T12:00:00Z'), 'UTC'), 'easter') // -2 days
  assert.equal(automaticThemeAt(new Date('2024-04-01T12:00:00Z'), 'UTC'), 'easter') // +1 day
  assert.equal(automaticThemeAt(new Date('2024-04-02T12:00:00Z'), 'UTC'), null) // +2 days, outside
  assert.equal(automaticThemeAt(new Date('2024-03-28T12:00:00Z'), 'UTC'), null) // -3 days, outside
  // Easter Sunday 2025 fell on 20 April.
  assert.equal(automaticThemeAt(new Date('2025-04-20T12:00:00Z'), 'UTC'), 'easter')
})

test('automaticThemeAt returns null on an ordinary day', () => {
  assert.equal(automaticThemeAt(new Date('2026-07-15T12:00:00Z'), 'UTC'), null)
})

test('normaliseSeasonalSettings keeps valid values and falls back to defaults for junk', () => {
  assert.deepEqual(
    normaliseSeasonalSettings({
      automaticEnabled: false,
      scheduledTheme: 'halloween',
      scheduledStartsAt: '2026-10-01T00:00:00Z',
      scheduledEndsAt: '2026-10-31T23:59:59Z',
      scheduledLocation: 'australia',
      extra: 'ignored',
    }),
    {
      automaticEnabled: false,
      scheduledTheme: 'halloween',
      scheduledStartsAt: '2026-10-01T00:00:00Z',
      scheduledEndsAt: '2026-10-31T23:59:59Z',
      scheduledLocation: 'australia',
    },
  )
  // Unknown theme / location are reset; non-string timestamps become null; automaticEnabled stays true unless explicitly false.
  assert.deepEqual(normaliseSeasonalSettings({ scheduledTheme: 'summer', scheduledLocation: 'moon', scheduledStartsAt: 123 }), {
    automaticEnabled: true,
    scheduledTheme: null,
    scheduledStartsAt: null,
    scheduledEndsAt: null,
    scheduledLocation: 'anywhere',
  })
  // Non-object input yields the full default.
  assert.deepEqual(normaliseSeasonalSettings('not-an-object'), DEFAULT_SEASONAL_SETTINGS)
  assert.deepEqual(normaliseSeasonalSettings(null), DEFAULT_SEASONAL_SETTINGS)
})

test('resolveGlobalTheme honours an active scheduled theme regardless of automatic mode', () => {
  const settings = {
    ...DEFAULT_SEASONAL_SETTINGS,
    automaticEnabled: false,
    scheduledTheme: 'halloween',
    scheduledStartsAt: '2026-10-01T00:00:00Z',
    scheduledEndsAt: '2026-10-31T23:59:59Z',
    scheduledLocation: 'anywhere',
  }
  assert.equal(resolveGlobalTheme(settings, new Date('2026-10-15T12:00:00Z'), 'UTC'), 'halloween')
  // Outside the scheduled window the schedule is ignored; with automatic disabled that means no theme.
  assert.equal(resolveGlobalTheme(settings, new Date('2026-11-15T12:00:00Z'), 'UTC'), null)
})

test('resolveGlobalTheme falls back to automatic themes when no schedule is active', () => {
  assert.equal(
    resolveGlobalTheme(DEFAULT_SEASONAL_SETTINGS, new Date('2026-12-25T12:00:00Z'), 'UTC'),
    'christmas',
  )
  // Disabling automatic themes hides every unscheduled event.
  const disabled = { ...DEFAULT_SEASONAL_SETTINGS, automaticEnabled: false }
  assert.equal(resolveGlobalTheme(disabled, new Date('2026-12-25T12:00:00Z'), 'UTC'), null)
})

test('resolveGlobalTheme scopes a scheduled theme to the requested location', () => {
  const base = {
    ...DEFAULT_SEASONAL_SETTINGS,
    automaticEnabled: false,
    scheduledTheme: 'halloween',
    scheduledStartsAt: '2026-10-01T00:00:00Z',
    scheduledEndsAt: '2026-10-31T23:59:59Z',
  }
  const during = new Date('2026-10-15T12:00:00Z')

  // An "australia"-scoped schedule shows only for Australian visitors.
  const australiaScoped = { ...base, scheduledLocation: 'australia' }
  assert.equal(resolveGlobalTheme(australiaScoped, during, 'Australia/Sydney'), 'halloween')
  assert.equal(resolveGlobalTheme(australiaScoped, during, 'Europe/London'), null)

  // An "outside-australia"-scoped schedule is the inverse.
  const outsideScoped = { ...base, scheduledLocation: 'outside-australia' }
  assert.equal(resolveGlobalTheme(outsideScoped, during, 'Europe/London'), 'halloween')
  assert.equal(resolveGlobalTheme(outsideScoped, during, 'Australia/Sydney'), null)
})

test('resolveGlobalTheme prefers the explicit perceivedLocation over the time zone', () => {
  const settings = {
    ...DEFAULT_SEASONAL_SETTINGS,
    automaticEnabled: false,
    scheduledTheme: 'halloween',
    scheduledStartsAt: '2026-10-01T00:00:00Z',
    scheduledEndsAt: '2026-10-31T23:59:59Z',
    scheduledLocation: 'australia',
  }
  const during = new Date('2026-10-15T12:00:00Z')
  // Visitor's time zone is European, but they declared themselves in Australia.
  assert.equal(resolveGlobalTheme(settings, during, 'Europe/London', 'australia'), 'halloween')
  assert.equal(resolveGlobalTheme(settings, during, 'Europe/London', 'outside-australia'), null)
})
