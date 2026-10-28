'use client'

import { useEffect, useState } from 'react'
import { customStatisticsRange, STATISTIC_RANGES, summarizeStatistics, type DailyStatistic, type ProfileStatistics } from '@/lib/profile-statistics'

const number = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))

function Change({ value }: { value: number | null }) {
  return <p className="mt-2 text-xs text-white/60">{value === null ? 'Comparison needs more complete history' : <><span className={value >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{value > 0 ? '+' : ''}{number(value)}%</span> across completed days vs previous period</>}</p>
}

function HistoryChart({ daily, metric }: { daily: DailyStatistic[]; metric: 'views' | 'likes' }) {
  const [active, setActive] = useState(daily.length - 1)
  const selected = daily[active]
  const colour = metric === 'views' ? '#7dd3fc' : '#fda4af'
  const max = Math.max(1, ...daily.map(day => day[metric] ?? 0))
  const x = (index: number) => 40 + index * (620 / Math.max(1, daily.length - 1))
  const y = (value: number) => 180 - (value / max) * 140
  const points = daily.flatMap((day, index) => day[metric] === null ? [] : [`${x(index)},${y(day[metric]!)}`]).join(' ')
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-6" aria-label={`Daily ${metric}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-semibold capitalize text-white">Daily {metric}</h2><p className="mt-1 text-xs text-white/50">Select a point to explore</p></div>
        <p className="text-right text-xs text-white/60" aria-live="polite">{date(selected.date)} UTC<span className="mt-1 block text-xl font-bold tabular-nums" style={{ color: colour }}>{selected[metric] === null ? 'Untracked' : number(selected[metric]!)}</span></p>
      </div>
      <svg viewBox="0 0 700 220" className="mt-4 w-full overflow-visible" role="group" aria-label={`${metric} chart. Daily values are also available in the data table below.`}>
        {[0, 0.5, 1].map(fraction => <g key={fraction}>
          <line x1="40" x2="660" y1={y(max * fraction)} y2={y(max * fraction)} stroke="white" strokeOpacity="0.1" strokeDasharray="4 5" />
          <text x="30" y={y(max * fraction) + 4} textAnchor="end" fill="#9ca3af" fontSize="11">{number(max * fraction)}</text>
        </g>)}
        <polyline points={points} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" />
        {daily.map((day, index) => day[metric] === null ? null : <g key={day.date}>
          <rect x={x(index) - 310 / daily.length} width={620 / daily.length} y="25" height="165" fill="transparent" tabIndex={index === active ? 0 : -1} role="button" aria-label={`${date(day.date)}: ${day[metric]} ${metric}`} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActive(index) } }} className="cursor-pointer outline-none focus:stroke-white focus:stroke-2" />
          {index === active && <><line x1={x(index)} x2={x(index)} y1="25" y2="185" stroke={colour} strokeOpacity="0.35" pointerEvents="none" /><circle cx={x(index)} cy={y(day[metric]!)} r="4" fill={colour} pointerEvents="none" /></>}
        </g>)}
        <text x="40" y="213" fill="#9ca3af" fontSize="12">{date(daily[0].date)}</text>
        <text x="660" y="213" textAnchor="end" fill="#9ca3af" fontSize="12">{date(daily[daily.length - 1].date)}</text>
      </svg>
      <label className="mt-2 block text-xs text-white/60">Explore {metric} by date
        <input type="range" min={0} max={daily.length - 1} value={active} disabled={daily.length === 1} onChange={event => setActive(Number(event.target.value))} aria-valuetext={`${selected.date}: ${selected[metric] === null ? 'Untracked' : `${selected[metric]} ${metric}`}`} className="mt-2 block w-full accent-sky-200" />
      </label>
    </section>
  )
}

export function StatisticsContent({ data }: { data: ProfileStatistics }) {
  const summary = summarizeStatistics(data)
  const days = summary.days
  const updated = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(data.generatedAt))
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <section className="rounded-2xl border border-sky-300/20 bg-gradient-to-br from-sky-400/10 to-transparent p-5"><h2 className="text-sm text-sky-100/80">Views this period</h2><p className="mt-3 text-4xl font-bold tabular-nums text-white">{number(summary.views)}</p><Change value={summary.viewsChange} /><p className="mt-4 text-xs text-white/50">{number(data.totals.views)} lifetime views</p></section>
      <section className="rounded-2xl border border-rose-300/20 bg-gradient-to-br from-rose-400/10 to-transparent p-5"><h2 className="text-sm text-rose-100/80">Likes this period</h2><p className="mt-3 text-4xl font-bold tabular-nums text-white">{number(summary.likes)}</p><Change value={summary.likesChange} /><p className="mt-4 text-xs text-white/50">{number(data.totals.likes)} lifetime likes</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h2 className="text-sm text-white/70">Average daily views</h2><p className="mt-3 text-4xl font-bold tabular-nums text-white">{summary.averageViews === null ? '—' : number(summary.averageViews)}</p><p className="mt-2 text-xs text-white/60">Completed, fully tracked days only</p><p className="mt-4 text-xs text-white/50">{summary.recordedDays} of {days} days have history</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h2 className="text-sm text-white/70">Likes per 100 views</h2><p className="mt-3 text-4xl font-bold tabular-nums text-white">{summary.likesPerHundredViews === null ? '—' : number(summary.likesPerHundredViews)}</p><p className="mt-2 text-xs text-white/60">Activity ratio for this period</p><p className="mt-4 text-xs text-white/50">Views and likes count browsers differently.</p></section>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><HistoryChart key={`${days}-views`} daily={summary.current} metric="views" /><HistoryChart key={`${days}-likes`} daily={summary.current} metric="likes" /></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {(['views', 'likes'] as const).map(metric => {
        const best = metric === 'views' ? summary.bestViews : summary.bestLikes
        return <section key={metric} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h2 className="text-sm font-semibold text-white">{metric === 'views' ? 'Busiest day' : 'Most loved day'}</h2><p className="mt-2 text-xl font-bold text-white">{best ? `${date(best.date)} · ${number(best[metric]!)} ${metric}` : 'Your next highlight is ahead'}</p><p className="mt-1 text-xs text-white/50">{best ? 'Best completed day in the selected period' : 'Appears after a fully tracked day with activity'}</p></section>
      })}
    </div>
    <section className="mt-5" aria-labelledby="activity-insights">
      <h2 id="activity-insights" className="mb-3 text-lg font-semibold">Activity insights</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h3 className="text-sm text-white/70">Activity consistency</h3><p className="mt-3 text-2xl font-bold">{summary.completedDays ? `${number(summary.activeDays / summary.completedDays * 100)}%` : '—'}</p><p className="mt-2 text-xs text-white/60">{summary.completedDays ? `${summary.activeDays} of ${summary.completedDays} complete days received views.` : 'Needs a fully tracked, completed day.'}</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h3 className="text-sm text-white/70">Longest active run</h3><p className="mt-3 text-2xl font-bold">{summary.completedDays ? `${summary.longestStreak} ${summary.longestStreak === 1 ? 'day' : 'days'}` : '—'}</p><p className="mt-2 text-xs text-white/60">Consecutive completed days with views within this period.</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h3 className="text-sm text-white/70">A typical day</h3><p className="mt-3 text-2xl font-bold">{summary.medianViews === null ? '—' : `${number(summary.medianViews)} views`}</p><p className="mt-2 text-xs text-white/60">Median of complete days, reducing the influence of occasional spikes.</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h3 className="text-sm text-white/70">Peak day share</h3><p className="mt-3 text-2xl font-bold">{summary.peakShare === null ? '—' : `${number(summary.peakShare)}%`}</p><p className="mt-2 text-xs text-white/60">Share of complete-day views contributed by your busiest day.</p></section>
      </div>
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <h3 className="font-semibold">Your weekday rhythm</h3>
        <p className="mt-2 text-sm text-white/70">{summary.strongestWeekday ? `${summary.strongestWeekday.label} leads with ${number(summary.strongestWeekday.average!)} views per complete day on average.` : summary.weekdayReady ? 'No single weekday stands out in this period.' : 'A weekday comparison needs at least two fully tracked, completed days for every weekday.'}</p>
        <div className="mt-4 space-y-3" aria-label="Average daily views by UTC weekday">
          {summary.weekdays.map(day => <div key={day.label} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-xs" title={`${day.samples} complete ${day.samples === 1 ? 'day' : 'days'}`}><span className="text-white/70">{day.label}</span><div className="h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-sky-300/70" style={{ width: `${(day.average ?? 0) / Math.max(1, ...summary.weekdays.map(value => value.average ?? 0)) * 100}%` }} /></div><span className="text-right tabular-nums text-white/80">{day.average === null ? '—' : number(day.average)}</span></div>)}
        </div>
        <p className="mt-4 text-xs text-white/50">UTC weekdays · averages include zero-activity days. Samples can differ by weekday. Observed activity does not establish why a day performed better.</p>
      </section>
    </section>
    <details className="mt-5 rounded-2xl border border-white/10 p-5"><summary className="cursor-pointer text-sm font-semibold text-white">Explore daily data</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm tabular-nums"><caption className="sr-only">Daily profile statistics in UTC. A dash means no history was collected.</caption><thead className="text-white/60"><tr><th className="py-2">Date (UTC)</th><th className="py-2 text-right">Views</th><th className="py-2 text-right">Likes</th></tr></thead><tbody>{summary.current.slice().reverse().map(day => <tr key={day.date} className="border-t border-white/10 text-white/80"><th scope="row" className="py-2 font-normal">{day.date}{day.date === data.generatedAt.slice(0, 10) ? ' · in progress' : day.date === data.trackedSince.slice(0, 10) ? ' · partial' : ''}</th><td className="py-2 text-right">{day.views === null ? '—' : number(day.views)}</td><td className="py-2 text-right">{day.likes === null ? '—' : number(day.likes)}</td></tr>)}</tbody></table></div></details>
    <aside className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-xs leading-relaxed text-white/60"><h2 className="mb-2 font-semibold text-white/80">What these numbers mean</h2><p>History started {date(data.trackedSince.slice(0, 10))}, {data.trackedSince.slice(0, 4)} (UTC). Earlier dates are untracked. The first day and today are partial; averages, highlights and comparisons use complete days. Comparisons match completed days against the same days in the preceding period and need a non-zero baseline.</p><p className="mt-2">Views use the existing 24-hour browser cookie. Likes count once per stored browser identity. These are activity counts, not unique people or a conversion rate. Browser resets can affect counts. History stores daily totals without adding visitor identifiers.</p><p className="mt-2">Updated at {updated} UTC. Refresh to fetch new activity.</p></aside>
  </>
}

export default function ProfileStatisticsClient() {
  const [days, setDays] = useState(30)
  const [custom, setCustom] = useState<{ start: string; end: string; days: number } | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<{ key: string; data: ProfileStatistics } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const query = custom ? `start=${custom.start}&end=${custom.end}` : `days=${days}`
  function openCustom() {
    const end = custom?.end ?? result?.data.range.end ?? new Date().toISOString().slice(0, 10)
    setDraftEnd(end)
    setDraftStart(custom?.start ?? result?.data.range.start ?? new Date(Date.parse(`${end}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10))
    setRangeError(null)
    setCustomOpen(value => !value)
  }
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setResult(null)
    async function load() {
      try {
        const response = await fetch(`/api/dashboard/statistics?${query}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 401 ? 'Your Dashboard session has expired. Sign in again to view statistics.' : 'Statistics are unavailable. Check database setup and try again.')
        const data: ProfileStatistics = await response.json()
        if (!controller.signal.aborted) setResult({ key: query, data })
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Statistics are unavailable.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [query, refresh])
  return <main className="min-h-screen bg-[#17191d] px-4 py-8 text-white sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <a href="/dashboard" className="text-sm text-white/65 underline-offset-4 hover:text-white hover:underline">← Dashboard</a>
    <header className="mb-7 mt-7 flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/70">Dashboard / Statistics</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your profile, in numbers.</h1><p className="mt-2 text-sm text-white/60">See what&apos;s getting attention and how activity is changing.</p></div><div className="flex flex-wrap items-center gap-3"><div className="flex rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="History period">{STATISTIC_RANGES.map(range => <button key={range} type="button" aria-pressed={!custom && days === range} onClick={() => { setCustom(null); setDays(range); setCustomOpen(false); setRangeError(null) }} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${!custom && days === range ? 'bg-white text-black' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>{range} days</button>)}</div><button type="button" aria-expanded={customOpen} aria-controls="custom-statistics-range" aria-pressed={!!custom} onClick={openCustom} className={`rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold ${custom ? 'bg-white text-black' : 'hover:bg-white/10'}`}>Custom</button><button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-40">Refresh</button></div></header>
    {customOpen && <form id="custom-statistics-range" className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-5" onSubmit={event => {
      event.preventDefault()
      const range = customStatisticsRange(draftStart, draftEnd)
      if (!range) { setRangeError('Choose real start/end dates in order, up to 366 days, ending no later than today (UTC).'); return }
      setRangeError(null)
      setCustom(range)
    }}>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="min-w-0 text-sm text-white/80" htmlFor="statistics-start">Start date (UTC)<input id="statistics-start" type="date" required min="2000-01-01" max={draftEnd || new Date().toISOString().slice(0, 10)} value={draftStart} onChange={event => setDraftStart(event.target.value)} className="mt-2 block w-full min-w-0 rounded-lg border border-white/20 bg-[#17191d] p-3 text-white [color-scheme:dark]" /></label>
        <label className="min-w-0 text-sm text-white/80" htmlFor="statistics-end">End date (UTC)<input id="statistics-end" type="date" required min={draftStart || '2000-01-01'} max={new Date().toISOString().slice(0, 10)} value={draftEnd} onChange={event => setDraftEnd(event.target.value)} className="mt-2 block w-full min-w-0 rounded-lg border border-white/20 bg-[#17191d] p-3 text-white [color-scheme:dark]" /></label>
        <button type="submit" className="rounded-lg bg-sky-200 px-5 py-3 text-sm font-semibold text-black hover:bg-sky-100">Apply range</button>
      </div>
      <p className="mt-3 text-xs text-white/60">Both dates included · up to 366 days · dates before collection started remain untracked.</p>
      {rangeError && <p role="alert" className="mt-2 text-sm text-rose-200">{rangeError}</p>}
    </form>}
    {custom && <p className="mb-5 text-sm text-sky-100" role="status">Custom period: {custom.start} → {custom.end} · {custom.days} {custom.days === 1 ? 'day' : 'days'} (UTC)</p>}
    {loading && <div role="status" className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/70">Loading your statistics…</div>}
    {error && <div role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-400/5 p-6"><h2 className="font-semibold">Statistics unavailable</h2><p className="mt-2 text-sm text-white/70">{error}</p><a href="/auth/signin" className="mt-3 inline-block text-sm underline">Sign in</a><p className="mt-2 text-xs text-white/50">If setup is pending, apply the profile statistics migration before trying again.</p></div>}
    {!loading && !error && result?.key === query && <StatisticsContent data={result.data} />}
  </div></main>
}
