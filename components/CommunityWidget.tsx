'use client'

import FeatureLayout from './FeatureLayout'

import { siteConfig } from '@/lib/site-config.mjs'

import { useEffect, useState } from 'react'
import { COMMUNITY_LINKS } from '@/lib/community-profiles.mjs'
import { startPolling, fetchWidgetJson } from '@/lib/widget-polling.mjs'
import ModuleHeader from './ModuleHeader'

type Profile = {
  name: string; username: string; avatarUrl?: string
  status?: 'online' | 'offline' | 'in-game' | 'unknown'; game?: string; gameUrl?: string
  stats: { label: string; value: string | number | null; url?: string }[]
  providerStatus: 'healthy' | 'degraded'
}

export default function CommunityWidget({ service, visible }: { service: 'roblox' | 'steam'; visible: Record<string, boolean> }) {
  const [data, setData] = useState<Profile | null>(null)
  const [failed, setFailed] = useState(false)
  const show = (part: string) => visible[`${service}_${part}`] === true
  const title = service === 'steam' ? 'Steam' : 'Roblox'
  useEffect(() => startPolling({ intervalMs: 60_000, poll: async (signal: AbortSignal) => {
    const next = await fetchWidgetJson(`/api/community/${service}`, signal) as Profile
    if (!signal.aborted) { setData(next); setFailed(false) }
  }, onError: () => setFailed(true) }), [service])

  const status = failed ? 'unknown' : data?.status
  const statusLabel = status === 'in-game' ? 'In game' : status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Status unavailable'
  const details = show(service === 'steam' ? 'activity' : 'stats')
  const stats = data?.stats.filter((_, index) => details && show((service === 'steam' ? ['hours', 'library'] : ['friends', 'followers', 'following'])[index])) ?? []
  return <FeatureLayout module={service}><section aria-label={title} className="profile-module w-full space-y-3 text-white">
    <ModuleHeader service={service} title={title} href={COMMUNITY_LINKS[service]} name={data?.name ?? siteConfig.profile.username} username={data?.username ?? (service === 'steam' ? siteConfig.providers.steam.username : '')} avatarUrl={data?.avatarUrl} visible={visible}>
      {service === 'steam' && details && show('status') && <span data-feature="steam_status" className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${status === 'in-game' ? 'bg-green-400/15 text-green-200' : status === 'online' ? 'bg-sky-400/15 text-sky-200' : 'bg-white/10 text-white/65'}`}>{statusLabel}</span>}
    </ModuleHeader>
    {!data && !failed && <p role="status" className="animate-pulse text-xs text-white/65">Loading {title}…</p>}
    {failed && <p role="status" className="text-xs text-white/65">{title} could not refresh.{data ? ' Showing the last available profile details.' : ' The profile name still opens the page.'}</p>}
    {service === 'steam' && details && show('game') && !failed && data?.game && <div data-feature="steam_game" className="rounded-lg bg-green-400/10 px-3 py-2 text-xs text-green-100"><span className="block text-[10px] font-semibold uppercase tracking-wide text-green-200/70">Currently playing</span>{data.gameUrl ? <a href={data.gameUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block break-words font-semibold hover:underline">{data.game} ↗</a> : <span className="mt-1 block break-words font-semibold">{data.game}</span>}</div>}
    {stats.length > 0 && <dl data-feature={`${service}_${service === 'steam' ? 'activity' : 'stats'}`} className={`grid gap-2 text-center text-[11px] ${stats.length === 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {stats.map(({ label, value, url }) => <div key={label} data-feature={`${service}_${({ Friends: 'friends', Followers: 'followers', Following: 'following', 'Hours · past 2 weeks': 'hours', 'Games in library': 'library' } as Record<string, string>)[label]}`} className="flex min-w-0 flex-col rounded-lg bg-white/5 px-2 py-2"><dt className="order-2 mt-0.5 text-white/60">{label}</dt><dd className="order-1 break-words text-sm font-semibold">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">{value === null ? 'View games' : typeof value === 'number' ? value.toLocaleString('en-US') : value} ↗</a> : value === null ? <span className="text-xs text-white/50">Unavailable</span> : typeof value === 'number' ? value.toLocaleString('en-US') : value}</dd></div>)}
    </dl>}
  </section></FeatureLayout>
}
