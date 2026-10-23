'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { startPolling, fetchWidgetJson } from '@/lib/widget-polling.mjs'

const YouTubeEmbed = dynamic(() => import('./YouTubeEmbed'))

type LatestVideo = { id: string; title: string; url: string; publishedAt?: string; thumbnailUrl: string; views?: number }
type YouTubeData = {
  latest?: LatestVideo
  short?: LatestVideo
  longform?: LatestVideo
  channel?: { title?: string; avatarUrl?: string; url: string; subscribers?: string; totalViews?: string; videoCount?: string }
  live?: { status: 'live' | 'offline' | 'unknown'; url?: string; title?: string }
  uploadsUnavailable?: boolean
  updatedAt?: string
  formatsUnavailable?: { shorts: boolean; videos: boolean }
}

function postedDate(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) : 'Date unavailable'
}

export default function YouTubeWidget({ showStats, showLatest, showLive, includeShorts = true, includeVideos = true, showEmbed = false }: { showStats: boolean; showLatest: boolean; showLive: boolean; includeShorts?: boolean; includeVideos?: boolean; showEmbed?: boolean }) {
  const [data, setData] = useState<YouTubeData | null>(null)
  const [failed, setFailed] = useState(false)
  const enabled = showStats || showLatest || showLive
  useEffect(() => {
    if (!enabled) return
    return startPolling({ intervalMs: 60_000, timeoutMs: 30_000, poll: async (signal: AbortSignal) => {
      const next = await fetchWidgetJson('/api/youtube', signal) as YouTubeData
      if (!signal.aborted) { setData(next); setFailed(false) }
    }, onError: () => setFailed(true) })
  }, [enabled])
  if (!enabled) return null
  const latest = includeShorts && includeVideos ? data?.latest : includeShorts ? data?.short : includeVideos ? data?.longform : undefined
  const label = includeShorts && includeVideos ? 'Latest upload' : includeShorts ? 'Latest Short' : 'Latest video'
  const unavailable = failed || (includeShorts && includeVideos ? data?.uploadsUnavailable : includeShorts ? data?.formatsUnavailable?.shorts : data?.formatsUnavailable?.videos)
  return (
    <section aria-label="YouTube" className="w-full space-y-3 rounded-2xl border border-red-400/35 bg-[#290b0b]/75 p-3 text-white shadow-lg shadow-red-500/10">
      <div className="flex items-center justify-between gap-2">
        <a href={data?.channel?.url ?? 'https://www.youtube.com/channel/UCJr64JsgfMr8SHeUhLA3lKw'} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2.5 hover:underline">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-500/15 text-red-200 ring-1 ring-red-300/30">{data?.channel?.avatarUrl ? <Image src={data.channel.avatarUrl} alt="" fill className="object-cover" unoptimized /> : <span aria-hidden>▶</span>}</span>
          <div className="min-w-0"><h2 className="flex items-center gap-1.5 text-sm font-semibold"><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-red-400"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>YouTube</h2><p className="mt-0.5 truncate text-[11px] text-red-200">{data?.channel?.title ?? 'COOLman'} ↗</p></div>
        </a>
        {showLive && <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${!failed && data?.live?.status === 'live' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/70'}`}>{!failed && data?.live?.status === 'live' ? '● LIVE' : !failed && data?.live?.status === 'offline' ? 'Offline' : 'Live status unavailable'}</span>}
      </div>
      {!data && !failed && <p role="status" className="animate-pulse text-xs text-white/70">Loading YouTube…</p>}
      {failed && <p role="status" className="text-xs text-white/70">YouTube could not refresh.{data ? ' Showing the last available data.' : ' Try again shortly.'}</p>}
      {showStats && data && <dl className="grid grid-cols-2 gap-2 text-center text-[11px]">
        {([['Subscribers', data.channel?.subscribers], ['Total views', data.channel?.totalViews], ['Public videos', data.channel?.videoCount]] as const).map(([label, value]) => <div key={label} className="flex flex-col rounded-lg bg-white/5 px-2 py-1.5"><dt className="order-2 mt-0.5 text-white/60">{label}</dt><dd className="order-1 break-words text-sm font-semibold" title={value ?? 'Unavailable'}>{value?.replace(/\s+(subscribers?|views?|videos?)$/i, '') ?? '—'}</dd></div>)}
        <div className="flex flex-col rounded-lg bg-white/5 px-2 py-1.5"><dt className="order-2 mt-0.5 text-white/60">Last upload</dt><dd className="order-1 text-sm font-semibold">{postedDate(data.latest?.publishedAt)}</dd></div>
      </dl>}
      {showLive && !failed && data?.live?.status === 'live' && data.live.url && <a href={data.live.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-red-600/30 p-3 text-xs font-semibold hover:bg-red-600/40">Watch live: {data.live.title ?? 'YouTube stream'} ↗</a>}
      {showLatest && data && <div className="border-t border-white/10 pt-2.5"><h3 className="text-[10px] font-bold uppercase tracking-widest text-red-200">{label}</h3>{latest ? <>
        <a href={latest.url} target="_blank" rel="noopener noreferrer" className="group mt-2 flex gap-2.5">
          {!showEmbed && <div className="relative h-[62px] w-[110px] shrink-0 overflow-hidden rounded-lg bg-white/10"><Image src={latest.thumbnailUrl} alt="" fill sizes="110px" className="object-cover transition-transform group-hover:scale-105" unoptimized /></div>}
          <div className="min-w-0 flex-1"><p className="line-clamp-2 break-words text-sm font-semibold leading-tight">{latest.title}</p><p className="mt-1 text-[10px] text-white/55">{latest.views === undefined ? 'Views unavailable' : `${latest.views.toLocaleString()} views`}</p><p className="mt-1 text-[10px] text-white/45">{latest.publishedAt && Number.isFinite(Date.parse(latest.publishedAt)) ? <time dateTime={latest.publishedAt}>{postedDate(latest.publishedAt)}</time> : 'Date unavailable'} · Watch ↗</p></div>
        </a>
        {showEmbed && <YouTubeEmbed key={latest.id} id={latest.id} title={latest.title} url={latest.url} />}
      </> : <p className="mt-2 text-[11px] text-white/55">{!includeShorts && !includeVideos ? 'Uploads are hidden by the global settings.' : unavailable ? 'Uploads are temporarily unavailable.' : includeShorts && !includeVideos ? 'No public Shorts found.' : 'No public videos found.'}</p>}</div>}
    </section>
  )
}
