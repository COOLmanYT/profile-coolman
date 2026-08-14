'use client'

import Image from 'next/image'
import { memo, useEffect, useRef, useState } from 'react'

interface TwitchPresence {
  isLive: boolean
  title?: string
  game?: string
  viewers?: number
  followers?: number | null
  subscribers?: number | null
  thumbnailUrl?: string
  startedAt?: string
  tags?: string[]
  channelName?: string
  channelUrl?: string
}

interface TwitchWidgetProps {
  showStats?: boolean
}

const TWITCH_POLL_MS = 30_000

function formatDuration(startedAt?: string) {
  if (!startedAt) return 'Live now'
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m live` : `${minutes}m live`
}

function TwitchWidget({ showStats = true }: TwitchWidgetProps) {
  const [presence, setPresence] = useState<TwitchPresence | null>(null)
  const [loaded, setLoaded] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const fetchPresence = async () => {
      try {
        const response = await fetch('/api/twitch', { cache: 'no-store' })
        const data = await response.json() as TwitchPresence
        if (mountedRef.current) setPresence(data)
      } catch {
        if (mountedRef.current) setPresence(null)
      } finally {
        if (mountedRef.current) setLoaded(true)
      }
    }

    fetchPresence()
    const interval = setInterval(fetchPresence, TWITCH_POLL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  if (loaded && !presence?.isLive) return null

  return (
    <div className="w-full rounded-2xl border border-[#9146ff]/35 bg-[#170b29]/75 p-3 shadow-lg shadow-[#9146ff]/10">
      {!loaded ? (
        <div className="h-24 animate-pulse rounded-xl bg-white/10" />
      ) : (
        <a href={presence?.channelUrl} target="_blank" rel="noopener noreferrer" className="block group">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            <span className="text-[#bf94ff] text-[10px] font-bold tracking-widest uppercase">Live on Twitch</span>
            <span className="ml-auto text-[10px] text-white/55">{formatDuration(presence?.startedAt)}</span>
          </div>
          <div className="flex gap-2.5">
            <div className="relative h-[72px] w-[128px] flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
              {presence?.thumbnailUrl && <Image src={presence.thumbnailUrl} alt={`${presence.channelName ?? 'Twitch'} live stream`} fill className="object-cover transition-transform duration-200 group-hover:scale-105" unoptimized />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-white">{presence?.title}</p>
              {presence?.game && <p className="mt-0.5 truncate text-xs text-[#bf94ff]">{presence.game}</p>}
              {showStats && (
                <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-white/65">
                  <span>👁 {presence?.viewers?.toLocaleString() ?? 0}</span>
                  {presence?.followers !== null && presence?.followers !== undefined && <span>♥ {presence.followers.toLocaleString()}</span>}
                  {presence?.subscribers !== null && presence?.subscribers !== undefined && <span>★ {presence.subscribers.toLocaleString()}</span>}
                </div>
              )}
            </div>
          </div>
        </a>
      )}
    </div>
  )
}

export default memo(TwitchWidget, (prev, next) => prev.showStats === next.showStats)
