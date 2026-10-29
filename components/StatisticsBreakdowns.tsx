'use client'

import { useState } from 'react'
import type { ProfileStatistics, StatisticBreakdown, StatisticDimension } from '@/lib/profile-statistics'

const number = (value: number) => value.toLocaleString('en')
const percent = (count: number, total: number) => `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(total ? count / total * 100 : 0)}%`
const panel = 'min-w-0 rounded-2xl border border-white/10 bg-white/[0.025]'
const tones = ['#7dd3fc', '#a5b4fc', '#5eead4', '#fcd34d', '#c4b5fd']
const technologies = [{ key: 'device', label: 'Devices' }, { key: 'os', label: 'Operating systems' }, { key: 'browser', label: 'Browsers' }] as const

function displayValue(dimension: StatisticDimension, value: string) {
  if (dimension === 'country' && /^[A-Z]{2}$/.test(value)) {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(value) ?? value } catch { return value }
  }
  return dimension === 'outbound' && value === '/' ? 'Profile home' : value
}

function CollectionState({ enabled }: { enabled: boolean | undefined }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-white/55"><span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-emerald-300' : 'bg-white/30'}`} />{enabled ? 'Collection on' : 'Collection off'}</span>
}

function Empty({ enabled }: { enabled: boolean | undefined }) {
  return <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-5 text-center"><span aria-hidden="true" className="mb-3 flex h-9 w-9 items-end justify-center gap-1 rounded-lg bg-white/5 p-2"><span className="h-2 w-1 rounded-sm bg-white/25" /><span className="h-4 w-1 rounded-sm bg-white/25" /><span className="h-3 w-1 rounded-sm bg-white/25" /></span><p className="text-sm text-white/75">No activity in this period</p><p className="mt-1 max-w-64 text-xs leading-relaxed text-white/45">{enabled ? 'New activity will appear here as it is recorded.' : 'Collection is off. Earlier activity is still available in its original date range.'}</p></div>
}

function RankedRows({ dimension, breakdown, enabled }: { dimension: StatisticDimension; breakdown: StatisticBreakdown | undefined; enabled: boolean | undefined }) {
  const [expanded, setExpanded] = useState(false)
  if (!breakdown?.total) return <Empty enabled={enabled} />
  const rows = breakdown.rows.slice(0, expanded ? 20 : 5)
  const max = Math.max(1, ...breakdown.rows.map(row => row.count))
  const shown = breakdown.rows.reduce((sum, row) => sum + row.count, 0)
  return <>
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 text-[10px] font-medium uppercase tracking-wider text-white/40" aria-hidden="true"><span>{dimension === 'country' ? 'Country' : dimension === 'outbound' ? 'Destination' : dimension === 'referrer' ? 'Source' : 'Type'}</span><span className="w-12 text-right">{dimension === 'outbound' ? 'Clicks' : 'Views'}</span><span className="w-12 text-right">Share</span></div>
    <ol className="space-y-1" aria-label={`${dimension} breakdown`}>
      {rows.map((row, index) => <li key={row.value} className="relative isolate overflow-hidden rounded-lg">
        <div aria-hidden="true" className="absolute inset-y-1 left-0 -z-10 rounded-md" style={{ width: `${row.count / max * 100}%`, backgroundColor: `${tones[dimension === 'outbound' ? 2 : index % tones.length]}10` }} />
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-2.5 py-3 text-xs sm:text-sm">
          <span className="flex min-w-0 items-center gap-2.5">{dimension === 'country' ? <span aria-hidden="true" className="flex h-6 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-[9px] font-semibold tracking-wide text-white/55">{/^[A-Z]{2}$/.test(row.value) ? row.value : '—'}</span> : <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: tones[dimension === 'outbound' ? 2 : index % tones.length] }} />}<span className="break-words text-white/85">{displayValue(dimension, row.value)}</span></span>
          <span className="w-12 text-right tabular-nums text-white/85"><span className="sr-only">{dimension === 'outbound' ? 'Clicks: ' : 'Views: '}</span>{number(row.count)}</span><span className="w-12 text-right tabular-nums text-white/45"><span className="sr-only">Share: </span>{percent(row.count, breakdown.total)}</span>
        </div>
      </li>)}
    </ol>
    {breakdown.rows.length > 5 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-4 w-full rounded-lg border border-white/10 py-2 text-xs text-white/65 hover:bg-white/5 hover:text-white">{expanded ? 'Show top 5' : `Show all ${breakdown.rows.length}`}</button>}
    {shown < breakdown.total && <p className="mt-3 text-[11px] text-white/45">Top 20 available · {percent(breakdown.total - shown, breakdown.total)} in other values</p>}
  </>
}

function BreakdownCard({ title, subtitle, dimension, data }: { title: string; subtitle: string; dimension: 'country' | 'referrer' | 'outbound'; data: ProfileStatistics }) {
  const breakdown = data.breakdowns?.categories[dimension]
  const enabled = data.collection?.[dimension]
  return <section className={`${panel} flex flex-col p-5 sm:p-6`} aria-label={title}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold tracking-tight">{title}</h3><p className="mt-1 text-xs text-white/45">{subtitle}</p></div><CollectionState enabled={enabled} /></div>
    <RankedRows dimension={dimension} breakdown={breakdown} enabled={enabled} />
    <p className="mt-auto pt-5 text-[11px] text-white/40">{number(breakdown?.total ?? 0)} recorded {dimension === 'outbound' ? 'clicks' : 'views'} · selected period</p>
  </section>
}

function TechnologyCard({ data }: { data: ProfileStatistics }) {
  const [selected, setSelected] = useState<'device' | 'os' | 'browser'>('device')
  const breakdown = data.breakdowns?.categories[selected]
  const enabled = data.collection?.[selected]
  const total = breakdown?.total ?? 0
  const rows = breakdown?.rows ?? []
  const other = total - rows.slice(0, 5).reduce((sum, row) => sum + row.count, 0)
  return <section className={`${panel} p-5 sm:p-6`} aria-label="Technology">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold tracking-tight">Technology</h3><p className="mt-1 text-xs text-white/45">How your profile is being viewed</p></div><CollectionState enabled={enabled} /></div>
    <div className="mb-6 flex flex-wrap gap-1 border-b border-white/10 pb-3" role="group" aria-label="Technology breakdown">{technologies.map(item => <button key={item.key} type="button" aria-pressed={selected === item.key} onClick={() => setSelected(item.key)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${selected === item.key ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white'}`}>{item.label}</button>)}</div>
    {total > 0 && <div className="mb-6 flex h-3 gap-1 overflow-hidden rounded-full" aria-hidden="true">{rows.slice(0, 5).map((row, index) => <div key={row.value} style={{ width: `${row.count / total * 100}%`, backgroundColor: tones[index] }} />)}{other > 0 && <div className="bg-white/20" style={{ width: `${other / total * 100}%` }} />}</div>}
    <RankedRows key={selected} dimension={selected} breakdown={breakdown} enabled={enabled} />
    <p className="mt-5 text-[11px] text-white/40">{number(total)} recorded views · broad families, no versions</p>
  </section>
}

function HourlyActivity({ data }: { data: ProfileStatistics }) {
  const breakdown = data.breakdowns?.categories.hour
  const values = new Map(breakdown?.rows.map(row => [row.value, row.count]))
  const hours = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour).padStart(2, '0'), count: values.get(String(hour).padStart(2, '0')) ?? 0 }))
  const max = Math.max(1, ...hours.map(row => row.count))
  const leaders = hours.filter(row => row.count === max)
  const [active, setActive] = useState<string | null>(null)
  const selected = hours.find(row => row.value === active) ?? leaders[0] ?? hours[0]
  return <section className={`${panel} p-5 sm:p-6`} aria-label="Hourly activity">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold tracking-tight">When people stop by</h3><p className="mt-1 text-xs text-white/45">Counted views by hour of day · UTC</p></div><CollectionState enabled={data.collection?.time} /></div>
    {!breakdown?.total ? <div className="mt-5"><Empty enabled={data.collection?.time} /></div> : <>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><p className="text-xs text-white/50">{leaders.length === 1 ? <>Busiest hour <span className="ml-1 font-medium text-white/85">{leaders[0].value}:00–{String((Number(leaders[0].value) + 1) % 24).padStart(2, '0')}:00 UTC</span></> : `${leaders.length} hours share the peak`}</p><p className="text-xs text-white/55" aria-live="polite"><span className="font-medium text-teal-200">{selected.value}:00 UTC</span> · {number(selected.count)} views · {percent(selected.count, breakdown.total)}</p></div>
      <div className="mt-5 grid h-32 grid-cols-[repeat(24,minmax(0,1fr))] items-end gap-1 sm:gap-2" role="group" aria-label="Views by UTC hour">
        {hours.map(hour => <button key={hour.value} type="button" aria-label={`${hour.value}:00 UTC: ${number(hour.count)} views`} aria-pressed={hour.value === selected.value} onMouseEnter={() => setActive(hour.value)} onFocus={() => setActive(hour.value)} onClick={() => setActive(hour.value)} className="group flex h-full items-end rounded-t-md bg-white/[0.025] outline-none focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#17191d]" title={`${hour.value}:00 UTC · ${number(hour.count)} views`}><span className={`block w-full rounded-t-sm transition-colors motion-reduce:transition-none ${hour.value === selected.value ? 'bg-teal-200' : 'bg-teal-300/35 group-hover:bg-teal-200/70'}`} style={{ height: `${hour.count / max * 100}%` }} /></button>)}
      </div>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-white/40" aria-hidden="true">{['00:00', '06:00', '12:00', '18:00', '23:00'].map(hour => <span key={hour}>{hour}</span>)}</div>
      <label className="mt-4 block text-xs text-white/50">Explore activity by hour<input type="range" min="0" max="23" value={Number(selected.value)} onChange={event => setActive(String(event.target.value).padStart(2, '0'))} aria-valuetext={`${selected.value}:00 UTC: ${number(selected.count)} views`} className="mt-2 block w-full accent-teal-200" /></label>
      <p className="mt-4 text-[11px] text-white/40">{number(breakdown.total)} recorded views · activity across this period, not time spent on the site</p>
    </>}
  </section>
}

export default function StatisticsBreakdowns({ data }: { data: ProfileStatistics }) {
  const collecting = Object.values(data.collection ?? {}).filter(Boolean).length
  return <section className="mt-9" aria-labelledby="statistics-breakdowns">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-200/65">Follow the attention</p><h2 id="statistics-breakdowns" className="mt-1 text-xl font-semibold tracking-tight">Audience &amp; navigation</h2></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/50">{collecting} of 7 categories collecting</span></div>
    {!data.breakdowns ? <div className={`${panel} p-6 text-sm text-white/60`}>Audience breakdowns are not available yet. Your view and like history is shown above.</div> : <>
      <div className="grid gap-4 lg:grid-cols-2"><BreakdownCard title="Coming from" subtitle="Where your profile gets discovered" dimension="referrer" data={data} /><BreakdownCard title="Going to" subtitle="What gets clicked on your profile" dimension="outbound" data={data} /><BreakdownCard title="Countries" subtitle="Approximate location of counted views" dimension="country" data={data} /><TechnologyCard data={data} /></div>
      <div className="mt-4"><HourlyActivity key={`${data.range.start}-${data.range.end}`} data={data} /></div>
    </>}
    <details className="mt-4 rounded-xl border border-white/10 px-4 py-3 text-xs text-white/45"><summary className="cursor-pointer text-white/60">About this data &amp; collection</summary><div className="mt-3 space-y-2 leading-relaxed"><p>All breakdowns use the selected UTC dates. {data.breakdowns ? `Collection started ${data.breakdowns.startedAt.slice(0, 10)} (UTC). ` : ''}These cover activity recorded while each category was enabled, so totals may differ from profile views. Changing collection keeps earlier aggregates.</p><p>Referrers use domains only; direct visits and unavailable or withheld referrers share Direct / Unknown. Destination clicks do not prove a visit, and embedded-player interactions are not included.</p><p>Devices, operating systems and browsers are broad families. No IPs, visitor IDs, raw user agents, URL queries or fragments are stored. Collection settings are in site.config.json.</p></div></details>
  </section>
}
