'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { COMMUNITY_LINKS } from '@/lib/community-profiles.mjs'
import { startPolling, fetchWidgetJson } from '@/lib/widget-polling.mjs'

type Profile = {
  name: string
  username: string
  avatarUrl?: string
  status?: 'online' | 'offline' | 'in-game' | 'unknown'
  game?: string
  stats: { label: string; value: string | number | null }[]
  providerStatus: 'healthy' | 'degraded'
}

const SERVICES = {
  roblox: { title: 'Roblox', username: '@COOLmangamer768', color: 'border-slate-300/30 bg-slate-950/75', accent: 'text-slate-200', icon: <path fill="currentColor" fillRule="evenodd" d="M5 1 23 5 19 23 1 19 5 1Zm5 8-1 5 5 1 1-5-5-1Z" /> },
  steam: { title: 'Steam', username: 'coolmanyt1', color: 'border-sky-400/35 bg-[#0c2136]/90', accent: 'text-sky-200', icon: <g fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="16" cy="7" r="5" /><circle cx="16" cy="7" r="2.5" /><circle cx="7" cy="17" r="3.5" /><path d="m1 13 6 4m2-3 4-4m-3 8 6-6" /></g> },
}

export default function CommunityWidget({ service, showDetails }: { service: keyof typeof SERVICES; showDetails: boolean }) {
  const [data, setData] = useState<Profile | null>(null)
  const [failed, setFailed] = useState(false)
  const config = SERVICES[service]
  useEffect(() => startPolling({
    intervalMs: 60_000,
    poll: async (signal: AbortSignal) => {
      const next = await fetchWidgetJson(`/api/community/${service}`, signal) as Profile
      if (!signal.aborted) { setData(next); setFailed(false) }
    },
    onError: () => setFailed(true),
  }), [service])

  const status = failed ? 'unknown' : data?.status
  const statusLabel = status === 'in-game' ? 'In game' : status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Status unavailable'
  return (
    <section aria-label={config.title} className={`w-full space-y-3 rounded-2xl border p-3 text-white shadow-lg ${config.color}`}>
      <div className="flex items-center justify-between gap-2">
        <a href={COMMUNITY_LINKS[service]} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20 ${config.accent}`}>
            {data?.avatarUrl ? <Image src={data.avatarUrl} alt="" fill sizes="40px" className="object-cover" unoptimized /> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">{config.icon}</svg>}
          </span>
          <div className="min-w-0">
            <h2 className={`flex items-center gap-1.5 text-sm font-semibold ${config.accent}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">{config.icon}</svg>{config.title}</h2>
            <p className="mt-0.5 truncate text-xs font-medium group-hover:underline">{data?.name ?? 'COOLman'} <span aria-hidden>↗</span></p>
            <p className="truncate text-[10px] text-white/55">{data?.username ?? config.username}</p>
          </div>
        </a>
        {service === 'steam' && showDetails && <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${status === 'in-game' ? 'bg-green-400/15 text-green-200' : status === 'online' ? 'bg-sky-400/15 text-sky-200' : 'bg-white/10 text-white/65'}`}>{statusLabel}</span>}
      </div>
      {!data && !failed && <p role="status" className="animate-pulse text-xs text-white/65">Loading {config.title}…</p>}
      {failed && <p role="status" className="text-xs text-white/65">{config.title} could not refresh.{data ? ' Showing the last available profile details.' : ' You can still visit the profile.'}</p>}
      {showDetails && data && <>
        {service === 'steam' && !failed && data.game && <p className="rounded-lg bg-green-400/10 px-3 py-2 text-xs text-green-100"><span className="block text-[10px] font-semibold uppercase tracking-wide text-green-200/70">Currently playing</span><span className="mt-1 block break-words font-semibold">{data.game}</span></p>}
        <dl className={`grid gap-2 text-center text-[11px] ${service === 'roblox' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {data.stats.map(({ label, value }) => <div key={label} className="flex min-w-0 flex-col rounded-lg bg-white/5 px-2 py-2"><dt className="order-2 mt-0.5 text-white/60">{label}</dt><dd className="order-1 break-words text-sm font-semibold" title={value === null ? 'Unavailable' : String(value)}>{value === null ? '—' : typeof value === 'number' ? value.toLocaleString('en-US') : value}</dd></div>)}
        </dl>
        {data.providerStatus === 'degraded' && <p className="text-[10px] text-white/55">Some details are private or temporarily unavailable.</p>}
      </>}
      <a href={COMMUNITY_LINKS[service]} target="_blank" rel="noopener noreferrer" className={`block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-semibold transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${config.accent}`}>View {config.title} profile <span aria-hidden>↗</span></a>
    </section>
  )
}
