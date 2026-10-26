'use client'

import FeatureLayout, { FeatureSlot } from './FeatureLayout'

import { siteConfig, providerLinks } from '@/lib/site-config.mjs'

import Image from 'next/image'
import { memo } from 'react'
import type { TwitchPresence, TwitchState } from '@/lib/use-twitch-presence'

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
  const event = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Profile//Twitch Stream//EN', 'BEGIN:VEVENT', `UID:stream-${start.getTime()}@${new URL(siteConfig.site.url).hostname}`, `DTSTAMP:${format(new Date())}`, `DTSTART:${format(start)}`, `DTEND:${format(end)}`, `SUMMARY:${escape(stream.title ?? `${siteConfig.profile.username} Twitch stream`)}`, `DESCRIPTION:${escape(`Watch ${siteConfig.profile.username} on Twitch${stream.category ? ` — ${stream.category}` : ''}`)}`, `URL:${providerLinks.twitch}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const url = URL.createObjectURL(new Blob([event], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'twitch-stream.ics'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function TwitchWidget({ state, showProfile = true, showStats = true, showLive = true, showSchedule = true, scheduleTimeZone }: { state: TwitchState; showProfile?: boolean; showStats?: boolean; showLive?: boolean; showSchedule?: boolean; scheduleTimeZone?: string }) {
  const { presence, loaded, isUnavailable } = state

  return (
    <FeatureLayout module="twitch"><div className="profile-module w-full">
      {isUnavailable && <p role="status" className="mb-2 text-xs text-white/55">Twitch temporarily unavailable</p>}
      {!loaded ? (
        <div className="h-24 animate-pulse rounded-xl bg-white/10" />
      ) : (
        <div className="group">
          <FeatureSlot data-feature="twitch_profile">{showProfile && <a href={presence?.channelUrl ?? providerLinks.twitch} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-[#bf94ff]/40">
              {presence?.profileImageUrl && <Image src={presence.profileImageUrl} alt={`${presence.channelName ?? 'Twitch'} profile`} fill className="object-cover" unoptimized />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold leading-tight text-white">{presence?.channelName ?? siteConfig.profile.username}</p>
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${!isUnavailable && presence?.isLive ? 'bg-red-500 animate-pulse' : 'bg-white/35'}`} aria-hidden="true" />
                <span className={`text-[9px] font-bold uppercase tracking-wider ${!isUnavailable && presence?.isLive ? 'text-red-300' : 'text-white/45'}`}>{isUnavailable ? 'Unavailable' : presence?.isLive ? 'Live' : 'Offline'}</span>
              </div>
              <p className="truncate text-[11px] text-[#bf94ff]">{presence?.channelLogin ? `twitch.tv/${presence.channelLogin}` : `twitch.tv/${siteConfig.providers.twitch.login}`}</p>
            </div>
          </a>}</FeatureSlot>
          <FeatureSlot data-feature="twitch_stats">{showStats && <a href={presence?.channelUrl ?? providerLinks.twitch} target="_blank" rel="noopener noreferrer" className={`${showProfile ? 'mt-3 ' : ''}grid grid-cols-2 gap-2 text-center text-[11px]`}>
            <div className="rounded-lg bg-white/5 px-2 py-1.5 text-white/75"><span className="block text-sm font-semibold text-white">{presence?.followers?.toLocaleString() ?? '—'}</span>Followers</div>
            <div className="rounded-lg bg-white/5 px-2 py-1.5 text-white/75"><span className="block text-sm font-semibold text-white">{presence?.subscribers?.toLocaleString() ?? '—'}</span>Subscribers</div>
          </a>}</FeatureSlot>
          <FeatureSlot data-feature="twitch_live">{showLive && !isUnavailable && presence?.isLive && (
            <a href={presence?.channelUrl ?? providerLinks.twitch} target="_blank" rel="noopener noreferrer" className={`${showProfile || showStats ? 'mt-3' : ''}`}>
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
            </a>
          )}</FeatureSlot>
          <FeatureSlot data-feature="twitch_schedule">{showSchedule && !presence?.isLive && presence?.nextStream && (
            <div><a href={presence?.channelUrl ?? providerLinks.twitch} target="_blank" rel="noopener noreferrer" className={`block ${showProfile || showStats ? 'mt-3 ' : ''}rounded-lg border border-[#bf94ff]/20 bg-white/5 px-3 py-2`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bf94ff]">Next stream</p>
              <p className="mt-1 truncate text-xs font-semibold text-white">{presence.nextStream.title ?? 'Scheduled stream'}</p>
              <p className="mt-0.5 text-[10px] text-white/55">{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', ...(scheduleTimeZone ? { timeZone: scheduleTimeZone } : {}) }).format(new Date(presence.nextStream.startsAt))}{presence.nextStream.category ? ` · ${presence.nextStream.category}` : ''}</p>
            </a><button type="button" onClick={() => downloadCalendarEvent(presence.nextStream!)} className="mt-2 w-full rounded-lg border border-[#bf94ff]/25 bg-[#9146ff]/15 px-3 py-1.5 text-[11px] font-semibold text-[#dec8ff] transition-colors hover:bg-[#9146ff]/25">Add to calendar</button></div>
          )}</FeatureSlot>

        </div>
      )}
    </div></FeatureLayout>
  )
}

export default memo(TwitchWidget)
