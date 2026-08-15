'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type LatestVideo = { id: string; title: string; url: string; publishedAt?: string; thumbnailUrl: string; views?: number }
type LatestVideos = { short?: LatestVideo; longform?: LatestVideo; unavailable?: boolean }

export default function YouTubeWidget({ showShort, showLongform }: { showShort: boolean; showLongform: boolean }) {
  const [videos, setVideos] = useState<LatestVideos | null>(null)

  useEffect(() => {
    let active = true
    if (!showShort && !showLongform) return () => { active = false }
    fetch('/api/youtube', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error(`YouTube request failed (${response.status})`)
      return response.json() as Promise<LatestVideos>
    }).then((data) => { if (active) setVideos(data) }).catch(() => { if (active) setVideos({ unavailable: true }) })
    return () => { active = false }
  }, [showLongform, showShort])

  if (!showShort && !showLongform) return null
  if (!videos) return <div className="h-20 w-full animate-pulse rounded-2xl border border-red-500/20 bg-black/20" />
  if (videos.unavailable) return null
  const selected = [showLongform && videos.longform && { label: 'Latest video', video: videos.longform }, showShort && videos.short && { label: 'Latest Short', video: videos.short }].filter(Boolean) as Array<{ label: string; video: LatestVideo }>
  if (selected.length === 0) return null
  return (
    <div className="w-full space-y-2">{selected.map(({ label, video }) => <a key={video.url} href={video.url} target="_blank" rel="noopener noreferrer" className="group block rounded-2xl border border-red-500/25 bg-black/25 p-3 transition-colors hover:bg-black/35"><div className="flex items-center gap-1.5"><span className="flex h-3 w-4 items-center justify-center rounded-sm bg-red-600 text-[7px] text-white">▶</span><span className="text-[10px] font-bold uppercase tracking-widest text-red-200">{label}</span></div><div className="mt-2.5 flex gap-2.5"><div className="relative h-[58px] w-[104px] flex-shrink-0 overflow-hidden rounded-lg bg-white/10"><Image src={video.thumbnailUrl} alt={label} fill className="object-cover transition-transform group-hover:scale-105" unoptimized /></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{video.title}</p><p className="mt-1 text-[10px] text-white/45">{video.publishedAt ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(video.publishedAt)) : 'Watch on YouTube'}{video.views !== undefined ? ` · 👁 ${video.views.toLocaleString()}` : ''} · Watch ↗</p></div></div></a>)}</div>
  )
}
