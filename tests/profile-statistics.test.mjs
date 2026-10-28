import assert from 'node:assert/strict'
import test from 'node:test'
import * as react from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const statistics = loadTypescript('lib/profile-statistics.ts', {})
const now = Date.parse('2026-10-28T12:00:00Z')
function fixture(days = 7, trackedSince = '2026-01-01T12:00:00Z', end = '2026-10-28') {
  const endTime = Date.parse(`${end}T12:00:00Z`)
  return {
    trackedSince, generatedAt: new Date(now).toISOString(), totals: { views: 12500, likes: 220 },
    range: { start: new Date(endTime - (days - 1) * 86_400_000).toISOString().slice(0, 10), end },
    daily: Array.from({ length: days * 2 }, (_, index) => {
      const date = new Date(endTime - (days * 2 - 1 - index) * 86_400_000).toISOString().slice(0, 10)
      return { date, views: date < trackedSince.slice(0, 10) ? null : 10, likes: date < trackedSince.slice(0, 10) ? null : 1 }
    }),
  }
}
function route({ access = true, missing = false, failed = false, throws = false, data = fixture() } = {}) {
  const calls = []
  const handlers = loadTypescript('app/api/dashboard/statistics/route.ts', {
    'next-auth': { getServerSession: async () => access ? { user: { id: 'owner' } } : null },
    'next/server': nextServer, '@/lib/auth': { authOptions: {} },
    '@/lib/dashboard-access': { dashboardAccess: async session => session?.user?.id === 'owner' ? {} : null },
    '@/lib/profile-statistics': statistics,
    '@/lib/supabase-server': { getSupabase: () => {
      if (missing) return null
      return { rpc: async (...args) => { calls.push(args); if (throws) throw new Error('private database detail'); return { data, error: failed ? { message: 'private database detail' } : null } } }
    } },
  })
  return { ...handlers, calls }
}
const request = (days = '7') => ({ nextUrl: new URL(`https://profile.test/api/dashboard/statistics${days === null ? '' : `?days=${days}`}`) })
const customRequest = (query) => ({ nextUrl: new URL(`https://profile.test/api/dashboard/statistics?${query}`) })

test('statistics API rejects unauthenticated access before touching storage and never caches responses', async () => {
  const api = route({ access: false })
  const response = await api.GET(request())
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('vary'), 'Cookie')
  assert.deepEqual(api.calls, [])
})

test('statistics ranges are bounded and authorized responses contain aggregates only', async () => {
  const api = route()
  for (const value of ['0', '1', '180', '-7', 'NaN', 'Infinity', '']) assert.equal((await api.GET(request(value))).status, 400)
  assert.equal(api.calls.length, 0)
  const response = await api.GET(request())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(await response.json(), fixture())
  assert.deepEqual(api.calls, [['get_profile_statistics', { p_days: 7 }]])
  for (const days of [30, 90]) assert.equal((await route({ data: fixture(days) }).GET(request(String(days)))).status, 200)
  const defaults = route({ data: fixture(30) })
  assert.equal((await defaults.GET(request(null))).status, 200)
  assert.equal(defaults.calls[0][1].p_days, 30)
})

test('custom ranges validate real UTC dates, order, inclusive length and the maximum bound before querying', async () => {
  assert.deepEqual(statistics.customStatisticsRange('2024-02-29', '2024-02-29', '2026-10-28'), { start: '2024-02-29', end: '2024-02-29', days: 1 })
  assert.equal(statistics.customStatisticsRange('2024-01-01', '2024-12-31', '2026-10-28').days, 366)
  for (const [start, end] of [['2023-02-29', '2023-03-01'], ['2026-02-30', '2026-03-01'], ['2026-1-01', '2026-02-01'], ['2026-05-02', '2026-05-01'], ['2024-01-01', '2025-01-01'], ['1999-12-31', '2000-01-01'], ['2026-10-28', '2026-10-29'], ['', '2026-10-01']]) assert.equal(statistics.customStatisticsRange(start, end, '2026-10-28'), null)
  const api = route()
  for (const query of ['start=2026-01-01', 'end=2026-01-01', 'start=&end=', 'start=2024-01-01&end=2025-01-01', 'start=2026-02-30&end=2026-03-01', 'start=2026-02-02&end=2026-02-01', 'start=2999-01-01&end=2999-01-02', 'start=2026-01-01&end=2026-01-07&days=7']) assert.equal((await api.GET(customRequest(query))).status, 400)
  assert.deepEqual(api.calls, [])
  const past = route({ data: fixture(10, '2026-01-01T12:00:00Z', '2026-09-30') })
  const response = await past.GET(customRequest('start=2026-09-21&end=2026-09-30'))
  assert.equal(response.status, 200)
  assert.deepEqual(past.calls, [['get_profile_statistics', { p_start: '2026-09-21', p_end: '2026-09-30' }]])
  assert.equal((await route({ data: fixture(1, '2026-01-01T12:00:00Z', '2026-09-30') }).GET(customRequest('start=2026-09-30&end=2026-09-30'))).status, 200)
  assert.equal((await route({ data: fixture(366, '2024-01-01T12:00:00Z', '2026-09-30') }).GET(customRequest('start=2025-09-30&end=2026-09-30'))).status, 200)
})

test('missing migration, failed queries and malformed data never become fake zero statistics', async () => {
  const unsafe = fixture(); unsafe.totals.views = Number.MAX_SAFE_INTEGER + 1
  const brokenSeries = fixture(); brokenSeries.daily[1].date = brokenSeries.daily[0].date
  for (const options of [{ missing: true }, { failed: true }, { throws: true }, { data: null }, { data: unsafe }, { data: brokenSeries }, { data: { ...fixture(), daily: [] } }]) {
    const response = await route(options).GET(request())
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const body = await response.json()
    assert.equal(body.totals, undefined)
    assert.doesNotMatch(JSON.stringify(body), /private database detail/)
  }
})

test('statistics page independently checks dashboard access and redirects denied visitors', async () => {
  for (const access of [false, true]) {
    const { default: Page } = loadTypescript('app/dashboard/statistics/page.tsx', {
      'next-auth': { getServerSession: async () => ({ user: { id: 'signed-in-user' } }) },
      'next/navigation': { redirect: path => { throw new Error(`redirect:${path}`) } },
      '@/lib/auth': { authOptions: {} }, '@/lib/dashboard-access': { dashboardAccess: async () => access ? {} : null },
      '@/components/ProfileStatisticsClient': { default: () => null }, 'react/jsx-runtime': jsxRuntime,
    })
    if (access) assert.ok(await Page())
    else await assert.rejects(Page(), /redirect:\/auth\/signin/)
  }
})

test('period totals preserve lifetime counts, while comparisons and averages exclude partial today', () => {
  const data = fixture()
  data.daily.at(-1).views = 1000
  for (const day of data.daily.slice(0, 7)) day.views = 5
  const summary = statistics.summarizeStatistics(data, 7)
  assert.equal(summary.views, 1060)
  assert.equal(summary.likes, 7)
  assert.equal(summary.averageViews, 10)
  assert.equal(summary.viewsChange, 100)
  assert.equal(summary.likesChange, 0)
  assert.equal(summary.bestViews.views, 10)
  assert.equal(data.totals.views, 12500)
})

test('past custom periods compare every completed day, including a one-day range', () => {
  const data = fixture(3, '2026-01-01T12:00:00Z', '2026-09-30')
  for (const day of data.daily.slice(0, 3)) day.views = 5
  const summary = statistics.summarizeStatistics(data)
  assert.equal(summary.days, 3)
  assert.equal(summary.completedDays, 3)
  assert.equal(summary.viewsChange, 100)
  assert.equal(summary.views, 30)
  const single = fixture(1, '2026-01-01T12:00:00Z', '2026-09-30')
  assert.equal(statistics.summarizeStatistics(single).viewsChange, 0)
  assert.equal(statistics.summarizeStatistics(fixture(1)).viewsChange, null)
})

test('insights include quiet days, ignore partial days and distinguish typical activity from a spike', () => {
  const data = fixture(7)
  for (const [index, views] of [0, 10, 20, 0, 30, 1000, 9999].entries()) data.daily[index + 7].views = views
  const summary = statistics.summarizeStatistics(data)
  assert.equal(summary.completedDays, 6)
  assert.equal(summary.activeDays, 4)
  assert.equal(summary.longestStreak, 2)
  assert.equal(summary.medianViews, 15)
  assert.equal(summary.peakShare, 1000 / 1060 * 100)
  assert.equal(summary.weekdayReady, false)
  assert.equal(summary.strongestWeekday, null)
  const unknown = statistics.summarizeStatistics(fixture(7, '2026-10-28T09:00:00Z'))
  assert.equal(unknown.completedDays, 0)
  assert.equal(unknown.medianViews, null)
  assert.equal(unknown.peakShare, null)
})

test('weekday insight needs repeat samples for every weekday and does not invent a winner for tied or zero activity', () => {
  const data = fixture(14, '2026-01-01T12:00:00Z', '2026-09-30')
  for (const day of data.daily) day.views = new Date(`${day.date}T00:00:00Z`).getUTCDay() === 1 ? 100 : 10
  const summary = statistics.summarizeStatistics(data)
  assert.equal(summary.weekdayReady, true)
  assert.equal(summary.strongestWeekday.label, 'Monday')
  assert.equal(summary.strongestWeekday.average, 100)
  assert.ok(summary.weekdays.every(day => day.samples === 2))
  for (const day of data.daily) day.views = 0
  assert.equal(statistics.summarizeStatistics(data).strongestWeekday, null)
  for (const day of data.daily) day.views = 10
  assert.equal(statistics.summarizeStatistics(data).strongestWeekday, null)
})

test('unknown days remain null and the installation day never creates misleading comparisons', () => {
  const data = fixture(7, '2026-10-28T09:00:00Z')
  const summary = statistics.summarizeStatistics(data, 7)
  assert.equal(summary.recordedDays, 1)
  assert.equal(summary.averageViews, null)
  assert.equal(summary.viewsChange, null)
  assert.equal(summary.bestViews, null)
  assert.equal(summary.current[0].views, null)
  const zero = fixture()
  for (const day of zero.daily) { day.views = 0; day.likes = 0 }
  const empty = statistics.summarizeStatistics(zero, 7)
  assert.equal(empty.likesPerHundredViews, null)
  assert.equal(empty.viewsChange, null)
  assert.equal(empty.bestViews, null)
})

test('statistics charts and table render tracked zeros, unknown dates and accessible daily values', () => {
  const { StatisticsContent } = loadTypescript('components/ProfileStatisticsClient.tsx', {
    react, 'react/jsx-runtime': jsxRuntime, '@/lib/profile-statistics': statistics,
  })
  const html = renderToStaticMarkup(react.createElement(StatisticsContent, { data: fixture(7, '2026-10-26T09:00:00Z'), days: 7 }))
  assert.match(html, /Daily views/)
  assert.match(html, /Daily likes/)
  assert.match(html, /Explore daily data/)
  assert.match(html, /2026-10-28.*in progress/)
  assert.match(html, /2026-10-26.*partial/)
  assert.match(html, /not unique people or a conversion rate/)
  assert.match(html, /tabindex="0"/)
  assert.match(html, /Activity insights/)
  assert.match(html, /Your weekday rhythm/)
  assert.match(html, /Explore views by date/)
})
