'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type LatestVideo = { title: string; url: string; publishedAt?: string; thumbnailUrl: string; unavailable?: boolean }

export default function YouTubeWidget() {
  const [video, setVideo] = useState<LatestVideo | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/youtube', { cache: 'no-store' }).then((response) => response.json()).then((data: LatestVideo) => { if (active) setVideo(data) }).catch(() => { if (active) setVideo({ title: '', url: '', thumbnailUrl: '', unavailable: true }) })
    return () => { active = false }
  }, [])

  if (!video) return <div className="h-20 w-full animate-pulse rounded-2xl border border-red-500/20 bg-black/20" />
  if (video.unavailable) return null
  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer" className="group w-full rounded-2xl border border-red-500/25 bg-black/25 p-3 transition-colors hover:bg-black/35">
      <div className="flex items-center gap-1.5"><span className="flex h-3 w-4 items-center justify-center rounded-sm bg-red-600 text-[7px] text-white">▶</span><span className="text-[10px] font-bold uppercase tracking-widest text-red-200">Latest on YouTube</span></div>
      <div className="mt-2.5 flex gap-2.5"><div className="relative h-[58px] w-[104px] flex-shrink-0 overflow-hidden rounded-lg bg-white/10">{video.thumbnailUrl && <Image src={video.thumbnailUrl} alt="Latest YouTube video" fill className="object-cover transition-transform group-hover:scale-105" unoptimized />}</div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{video.title}</p><p className="mt-1 text-[10px] text-white/45">{video.publishedAt ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(video.publishedAt)) : 'Watch on YouTube'} · Watch ↗</p></div></div>
    </a>
  )
}
