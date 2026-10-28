'use client'

import { useState } from 'react'
import type { ProfileStatistics, StatisticDimension } from '@/lib/profile-statistics'

const options: { key: StatisticDimension; label: string; collection: keyof NonNullable<ProfileStatistics['collection']>; detail: string }[] = [
  { key: 'country', label: 'Location · country', collection: 'country', detail: 'Approximate country supplied by the hosting platform. Missing location stays unknown.' },
  { key: 'hour', label: 'Time · hour of day', collection: 'time', detail: 'When counted views arrived, grouped by UTC hour. This does not measure time spent on the site.' },
  { key: 'referrer', label: 'Coming from', collection: 'referrer', detail: 'Referring domains only. Direct visits, unavailable and withheld referrers share Direct / Unknown.' },
  { key: 'outbound', label: 'Going to · most clicked', collection: 'outbound', detail: 'Clicks on public page paths and external domains from this profile. Clicks do not prove a destination visit. Embedded-player interactions are not included.' },
  { key: 'device', label: 'Device', collection: 'device', detail: 'Broad device type reported by the browser, not a device identity.' },
  { key: 'os', label: 'Operating system', collection: 'os', detail: 'Operating system family inferred from the request. Versions and raw user agents are not stored.' },
  { key: 'browser', label: 'Browser', collection: 'browser', detail: 'Browser family inferred from the request. Versions and raw user agents are not stored.' },
]
const number = (value: number) => value.toLocaleString('en')
function label(key: StatisticDimension, value: string) {
  if (key === 'country' && /^[A-Z]{2}$/.test(value)) {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(value) ?? value } catch { return value }
  }
  return key === 'hour' ? `${value}:00 UTC` : value
}

export default function StatisticsBreakdowns({ data }: { data: ProfileStatistics }) {
  const [selected, setSelected] = useState<StatisticDimension>('country')
  const option = options.find(item => item.key === selected)!
  const breakdown = data.breakdowns?.categories[selected]
  const rows = selected === 'hour' && breakdown ? Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour).padStart(2, '0')
    return { value, count: breakdown.rows.find(row => row.value === value)?.count ?? 0 }
  }) : breakdown?.rows ?? []
  const max = Math.max(1, ...rows.map(row => row.count))
  const enabled = data.collection?.[option.collection]
  return <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5" aria-labelledby="statistics-breakdowns">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 id="statistics-breakdowns" className="text-lg font-semibold">Audience &amp; navigation</h2><p className="mt-1 text-xs text-white/60">Same selected period · {data.range.start} → {data.range.end} (UTC)</p></div>
      <label className="min-w-0 text-xs text-white/70">Breakdown<select aria-label="Statistics breakdown" value={selected} onChange={event => setSelected(event.target.value as StatisticDimension)} className="mt-2 block max-w-full rounded-lg border border-white/20 bg-[#17191d] p-3 text-sm text-white">{options.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><h3 className="font-semibold">{option.label}</h3><span className={`rounded-full px-2 py-1 text-[10px] ${enabled ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/5 text-white/60'}`}>{enabled ? 'Collection on' : 'Collection off'}</span></div>
    <p className="mt-2 text-xs leading-relaxed text-white/60">{option.detail}</p>
    {!data.breakdowns ? <p className="mt-5 text-sm text-white/60">Breakdown storage is not available yet. Apply the statistics breakdowns migration to start collecting it.</p> : !breakdown?.total ? <p className="mt-5 text-sm text-white/60">No {selected === 'outbound' ? 'clicks' : 'views'} were recorded for this category in the selected period.</p> : <>
      <p className="mt-4 text-sm text-white/80">{number(breakdown.total)} recorded {selected === 'outbound' ? 'clicks' : 'views'}{selected !== 'hour' && rows.reduce((total, row) => total + row.count, 0) < breakdown.total ? ' · top 20 shown' : ''}</p>
      <div className="mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-1" role="list" aria-label={option.label}>
        {rows.map(row => <div key={row.value} role="listitem" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-xs"><span className="break-words text-white/80">{label(selected,row.value)}</span><span className="text-right tabular-nums text-white/70">{number(row.count)} <span className="text-white/45">· {Math.round(row.count / breakdown.total * 100)}%</span></span><div className="col-span-2 h-1.5 rounded-full bg-white/5"><div className={`h-1.5 rounded-full ${selected === 'outbound' ? 'bg-rose-300/70' : 'bg-sky-300/70'}`} style={{ width: `${row.count / max * 100}%` }} /></div></div>)}
      </div>
    </>}
    <p className="mt-5 text-xs leading-relaxed text-white/50">{data.breakdowns ? `Breakdowns started ${new Date(data.breakdowns.startedAt).toISOString().slice(0,10)} (UTC). ` : ''}These cover activity collected while each category was enabled, so they can differ from total views. Disabled collection keeps earlier aggregates. Change collection in site.config.json. No IPs, visitor IDs, raw user agents, URL queries or fragments are stored in these breakdowns.</p>
  </section>
}
