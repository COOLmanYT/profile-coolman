'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { TwitchPresence } from '@/lib/use-twitch-presence'

export default function StreamTakeover({ presence }: { presence: TwitchPresence }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  const start = Date.parse(presence.startedAt ?? '')
  const minutes = Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 60_000)) : null
  const uptime = minutes === null ? 'Live now' : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m live` : `${minutes}m live`

  return (
    <section aria-label="Live Twitch stream" className="relative isolate overflow-hidden bg-[#170b29]">
      <div className="relative aspect-video bg-[#281440]">
        {presence.thumbnailUrl && <Image src={presence.thumbnailUrl} alt="Live stream preview" fill sizes="(min-width: 1024px) 460px, 390px" className="object-cover" unoptimized />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#170b29] via-[#170b29]/25 to-black/15" />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white"><span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" aria-hidden />Live on Twitch</div>
      </div>
      <div className="relative -mt-10 px-5 pb-5 sm:px-7">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#bf94ff]">Come hang out</p>
        <h2 className="mt-1 break-words text-xl font-bold leading-tight text-white">{presence.title || 'COOLman is live!'}</h2>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/65">{presence.game && <span>{presence.game}</span>}<span>{presence.viewers?.toLocaleString() ?? 0} watching</span><span>{uptime}</span></p>
        <a href={presence.channelUrl ?? 'https://www.twitch.tv/coolman_yt1'} target="_blank" rel="noopener noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#9146ff] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#a970ff]">Watch the stream <span aria-hidden>↗</span></a>
      </div>
    </section>
  )
}
