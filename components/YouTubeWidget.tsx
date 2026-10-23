'use client'

import Image from 'next/image'
import { useState } from 'react'
import { usePolling } from './usePolling'

type LatestVideo = { id: string; title: string; url: string; publishedAt?: string; thumbnailUrl: string; views?: number }
type YouTubeData = {
  latest?: LatestVideo
  channel?: { title?: string; url: string; subscribers?: string; totalViews?: string; videoCount?: string }
  live?: { status: 'live' | 'offline' | 'unknown'; url?: string; title?: string }
  uploadsUnavailable?: boolean
  updatedAt?: string
}

function postedDate(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) : 'Date unavailable'
}

export default function YouTubeWidget({ showStats, showLatest, showLive }: { showStats: boolean; showLatest: boolean; showLive: boolean }) {
  const [data, setData] = useState<YouTubeData | null>(null)
  const [failed, setFailed] = useState(false)
  const enabled = showStats || showLatest || showLive
  usePolling(async (signal) => {
    if (!enabled) return
    try {
      const response = await fetch('/api/youtube', { cache: 'no-store', signal })
      if (!response.ok) throw new Error('YouTube unavailable')
      const next = await response.json() as YouTubeData
      if (!signal.aborted) { setData(next); setFailed(false) }
    } catch { if (!signal.aborted) setFailed(true) }
  }, { intervalMs: 60_000 })
  if (!enabled) return null
  const latest = data?.latest
  return (
    <section aria-label="YouTube" className="w-full space-y-3 rounded-2xl border border-red-400/25 bg-black/25 p-4 text-white">
      <div className="flex items-center justify-between gap-2">
        <a href={data?.channel?.url ?? 'https://www.youtube.com/channel/UCJr64JsgfMr8SHeUhLA3lKw'} target="_blank" rel="noopener noreferrer" className="min-w-0 hover:underline">
          <h2 className="text-sm font-bold"><span aria-hidden className="mr-2 text-red-300">▶</span>YouTube</h2>
          <p className="mt-1 truncate text-xs text-white/70">{data?.channel?.title ?? 'COOLmanGamer'} ↗</p>
        </a>
        {showLive && <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${!failed && data?.live?.status === 'live' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/70'}`}>{!failed && data?.live?.status === 'live' ? '● LIVE' : !failed && data?.live?.status === 'offline' ? 'Offline' : 'Live status unavailable'}</span>}
      </div>
      {!data && !failed && <p role="status" className="animate-pulse text-xs text-white/70">Loading YouTube…</p>}
      {failed && <p role="status" className="text-xs text-white/70">YouTube could not refresh.{data ? ' Showing the last available data.' : ' Try again shortly.'}</p>}
      {showStats && data && <dl className="grid grid-cols-2 gap-2 text-xs">
        {([['Subscribers', data.channel?.subscribers], ['Total views', data.channel?.totalViews], ['Public videos', data.channel?.videoCount]] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-white/5 p-2"><dt className="text-white/65">{label}</dt><dd className="mt-1 break-words font-semibold">{value ?? 'Unavailable'}</dd></div>)}
        <div className="rounded-lg bg-white/5 p-2"><dt className="text-white/65">Last upload</dt><dd className="mt-1 font-semibold">{latest ? postedDate(latest.publishedAt) : 'Unavailable'}</dd></div>
      </dl>}
      {showLive && !failed && data?.live?.status === 'live' && data.live.url && <a href={data.live.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-red-600/30 p-3 text-xs font-semibold hover:bg-red-600/40">Watch live: {data.live.title ?? 'YouTube stream'} ↗</a>}
      {showLatest && data && (latest ? <a href={latest.url} target="_blank" rel="noopener noreferrer" className="group block rounded-xl border border-white/10 p-2.5 hover:bg-white/5">
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-red-200">Latest upload · All formats</h3>
        <div className="relative aspect-video overflow-hidden rounded-lg bg-white/10"><Image src={latest.thumbnailUrl} alt="" fill sizes="(max-width: 640px) 85vw, 360px" className="object-cover transition-transform group-hover:scale-105" unoptimized /></div>
        <p className="mt-2 break-words text-sm font-semibold">{latest.title}</p>
        <p className="mt-1 text-xs text-white/70">{latest.views === undefined ? 'Views unavailable' : `${latest.views.toLocaleString()} views`}</p>
        <p className="mt-1 text-xs text-white/70">Posted {latest.publishedAt && Number.isFinite(Date.parse(latest.publishedAt)) ? <time dateTime={latest.publishedAt}>{postedDate(latest.publishedAt)}</time> : 'date unavailable'} · Watch ↗</p>
      </a> : <p className="text-xs text-white/70">{data.uploadsUnavailable ? 'Latest upload unavailable. Visit the channel to see new videos.' : 'No public uploads found.'}</p>)}
      {data?.updatedAt && <p className="text-[10px] text-white/55">Refreshes every minute · Counts may be delayed or rounded by YouTube.</p>}
    </section>
  )
}
