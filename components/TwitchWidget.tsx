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
  channelLogin?: string
  profileImageUrl?: string
  description?: string
  broadcasterType?: string
  channelUrl?: string
  nextStream?: { title?: string; category?: string; startsAt: string }
}

const TWITCH_POLL_MS = 30_000

function formatDuration(startedAt?: string) {
  if (!startedAt) return 'Live now'
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m live` : `${minutes}m live`
}

function downloadCalendarEvent(stream: NonNullable<TwitchPresence['nextStream']>) {
  const start = new Date(stream.startsAt)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const escape = (value: string) => value.replace(/[\\,;]/g, '\\$&').replace(/\n/g, '\\n')
  const event = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//COOLman//Twitch Stream//EN', 'BEGIN:VEVENT', `UID:coolman-${start.getTime()}@coolmanyt.com`, `DTSTAMP:${format(new Date())}`, `DTSTART:${format(start)}`, `DTEND:${format(end)}`, `SUMMARY:${escape(stream.title ?? 'COOLman Twitch stream')}`, `DESCRIPTION:${escape(`Watch COOLman on Twitch${stream.category ? ` — ${stream.category}` : ''}`)}`, 'URL:https://www.twitch.tv/coolman_yt1', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const url = URL.createObjectURL(new Blob([event], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'coolman-twitch-stream.ics'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function TwitchWidget({ showProfile = true, showStats = true, showLive = true, showSchedule = true, scheduleTimeZone }: { showProfile?: boolean; showStats?: boolean; showLive?: boolean; showSchedule?: boolean; scheduleTimeZone?: string }) {
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

  return (
    <div className="w-full rounded-2xl border border-[#9146ff]/35 bg-[#170b29]/75 p-3 shadow-lg shadow-[#9146ff]/10">
      {!loaded ? (
        <div className="h-24 animate-pulse rounded-xl bg-white/10" />
      ) : (
        <div className="group">
          <a href={presence?.channelUrl ?? 'https://www.twitch.tv/coolman_yt1'} target="_blank" rel="noopener noreferrer" className="block">
          {showProfile && <div className="flex items-center gap-2.5">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-[#bf94ff]/40">
              {presence?.profileImageUrl && <Image src={presence.profileImageUrl} alt={`${presence.channelName ?? 'Twitch'} profile`} fill className="object-cover" unoptimized />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold leading-tight text-white">{presence?.channelName ?? 'COOLmanYT'}</p>
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${presence?.isLive ? 'bg-red-500 animate-pulse' : 'bg-white/35'}`} aria-hidden="true" />
                <span className={`text-[9px] font-bold uppercase tracking-wider ${presence?.isLive ? 'text-red-300' : 'text-white/45'}`}>{presence?.isLive ? 'Live' : 'Offline'}</span>
              </div>
              <p className="truncate text-[11px] text-[#bf94ff]">{presence?.channelLogin ? `twitch.tv/${presence.channelLogin}` : 'twitch.tv/coolman_yt1'}</p>
            </div>
          </div>}
          {showStats && <div className={`${showProfile ? 'mt-3 ' : ''}grid grid-cols-2 gap-2 text-center text-[11px]`}>
            <div className="rounded-lg bg-white/5 px-2 py-1.5 text-white/75"><span className="block text-sm font-semibold text-white">{presence?.followers?.toLocaleString() ?? '—'}</span>Followers</div>
            <div className="rounded-lg bg-white/5 px-2 py-1.5 text-white/75"><span className="block text-sm font-semibold text-white">{presence?.subscribers?.toLocaleString() ?? '—'}</span>Subscribers</div>
          </div>}
          {showLive && presence?.isLive && (
            <div className={`${showProfile || showStats ? 'mt-3' : ''}`}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                <span className="text-[#bf94ff] text-[10px] font-bold tracking-widest uppercase">Live on Twitch</span>
                <span className="ml-auto text-[10px] text-white/55">{formatDuration(presence.startedAt)}</span>
              </div>
              <div className="flex gap-2.5">
                <div className="relative h-[72px] w-[128px] flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
                  {presence.thumbnailUrl && <Image src={presence.thumbnailUrl} alt={`${presence.channelName ?? 'Twitch'} live stream`} fill className="object-cover transition-transform duration-200 group-hover:scale-105" unoptimized />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight text-white">{presence.title}</p>
                  {presence.game && <p className="mt-0.5 truncate text-xs text-[#bf94ff]">{presence.game}</p>}
                  <p className="mt-2 text-[10px] text-white/65">👁 {presence.viewers?.toLocaleString() ?? 0} watching</p>
                </div>
              </div>
            </div>
          )}
          {showSchedule && !presence?.isLive && presence?.nextStream && (
            <div className={`${showProfile || showStats ? 'mt-3 ' : ''}rounded-lg border border-[#bf94ff]/20 bg-white/5 px-3 py-2`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bf94ff]">Next stream</p>
              <p className="mt-1 truncate text-xs font-semibold text-white">{presence.nextStream.title ?? 'Scheduled stream'}</p>
              <p className="mt-0.5 text-[10px] text-white/55">{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', ...(scheduleTimeZone ? { timeZone: scheduleTimeZone } : {}) }).format(new Date(presence.nextStream.startsAt))}{presence.nextStream.category ? ` · ${presence.nextStream.category}` : ''}</p>
            </div>
          )}
          </a>
          {showSchedule && !presence?.isLive && presence?.nextStream && <button type="button" onClick={() => downloadCalendarEvent(presence.nextStream!)} className="mt-2 w-full rounded-lg border border-[#bf94ff]/25 bg-[#9146ff]/15 px-3 py-1.5 text-[11px] font-semibold text-[#dec8ff] transition-colors hover:bg-[#9146ff]/25">Add to calendar</button>}
        </div>
      )}
    </div>
  )
}

export default memo(TwitchWidget, (prev, next) => prev.showProfile === next.showProfile && prev.showStats === next.showStats && prev.showLive === next.showLive && prev.showSchedule === next.showSchedule && prev.scheduleTimeZone === next.scheduleTimeZone)
