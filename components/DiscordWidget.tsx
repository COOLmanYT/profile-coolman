'use client'

import { memo, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

interface DiscordActivity {
  name: string
  type: number
  details?: string
  state?: string
  assets?: {
    large_image?: string
    large_text?: string
  }
  application_id?: string
}

interface DiscordPresence {
  discord_status: 'online' | 'idle' | 'dnd' | 'offline'
  activities: DiscordActivity[]
  kv?: Record<string, unknown>
  discord_user?: {
    username: string
    global_name?: string
    discriminator?: string
    avatar?: string
    banner?: string
    premium_type?: number
    premium_since?: string
    premium_guild_since?: string
    avatar_decoration_data?: {
      asset?: string
    }
    primary_guild?: {
      tag?: string
    }
    clan?: {
      tag?: string
    }
    public_flags?: number
    id: string
  }
}

interface DiscordWidgetProps {
  showMusic?: boolean
  showVideo?: boolean
  showGames?: boolean
  showStatus?: boolean
  showOther?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
}

function StatusIcon({ status, pulse = false }: { status: DiscordPresence['discord_status']; pulse?: boolean }) {
  const pulseClass = pulse ? 'status-change-pop' : ''
  if (status === 'online') {
    return <span aria-hidden className={`w-2.5 h-2.5 rounded-full bg-[#23a55a] status-online-glow transition-all duration-200 ease-out ${pulseClass}`} />
  }
  if (status === 'idle') {
    return (
      <span aria-hidden className={`relative w-3 h-3 rounded-full bg-[#f0b232] transition-all duration-200 ease-out ${pulseClass}`}>
        <span aria-hidden className="absolute right-[1px] top-[1px] w-[5px] h-[5px] rounded-full bg-[#1f1f1f]" />
      </span>
    )
  }
  if (status === 'dnd') {
    return (
      <svg aria-hidden viewBox="0 0 16 16" className={`w-3 h-3 text-[#f23f43] transition-all duration-200 ease-out ${pulseClass}`} fill="currentColor">
        <path d="M8 1a7 7 0 1 0 7 7A7.01 7.01 0 0 0 8 1Zm3.5 7.75h-7v-1.5h7Z" />
      </svg>
    )
  }
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`w-3 h-3 text-[#80848e] transition-all duration-200 ease-out ${pulseClass}`} fill="currentColor">
      <path d="M8 1a7 7 0 1 0 7 7A7.01 7.01 0 0 0 8 1Zm0 1.5a5.5 5.5 0 1 1-5.5 5.5A5.51 5.51 0 0 1 8 2.5Z" />
    </svg>
  )
}

function getDiscordAvatarUrl(user?: DiscordPresence['discord_user']) {
  if (!user?.id || !user?.avatar) return undefined
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`
}

function getAvatarDecorationUrl(user?: DiscordPresence['discord_user']) {
  const asset = user?.avatar_decoration_data?.asset
  if (!asset) return undefined
  return `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png?size=128&passthrough=true`
}

function getNameplateUrl(user?: DiscordPresence['discord_user']) {
  const record = user as (Record<string, unknown> | undefined)
  const nested = record?.nameplate as (Record<string, unknown> | undefined)
  const asset = (
    (nested?.asset as string | undefined)
    ?? (record?.nameplate_asset as string | undefined)
    ?? (record?.nameplateAsset as string | undefined)
  )
  if (!asset) return undefined
  return `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png?size=512&passthrough=true`
}

function getDiscordBannerUrl(user?: DiscordPresence['discord_user']) {
  if (!user?.id || !user?.banner) return undefined
  const ext = user.banner.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${ext}?size=480`
}

// Based on Discord user public_flags bit values:
// https://discord.com/developers/docs/resources/user#user-object-user-flags
const BADGE_MAP: Array<{ bit: number; label: string; iconHash: string }> = [
  { bit: 1 << 0, label: 'Staff', iconHash: '5e74e9b61934fc1f67c65515d1f7e60d' },
  { bit: 1 << 1, label: 'Partner', iconHash: '3f9748e53446a137a052f3454e2de41e' },
  { bit: 1 << 6, label: 'HypeSquad Bravery', iconHash: '8a88d63823d8a71cd5e390baa45efa02' },
  { bit: 1 << 7, label: 'HypeSquad Brilliance', iconHash: '011940fd013da3f7fb926e4a1cd2e618' },
  { bit: 1 << 8, label: 'HypeSquad Balance', iconHash: '3aa41de486fa12454c3761e8e223442e' },
  { bit: 1 << 9, label: 'Early Supporter', iconHash: '7060786766c9c840eb3019e725d2b358' },
  { bit: 1 << 17, label: 'Active Developer', iconHash: '6bdc42827a38498929a4920da12695d9' },
]
const SPECIAL_BADGES = {
  nitro1y: 'Nitro 1 Year',
  booster1y: 'Booster 1 Year',
  questComplete: 'Completed a Quest',
  orbsApprentice: 'Orbs Apprentice',
} as const
const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000
const NITRO_YEAR_HINTS = ['nitro_1_year', 'nitro 1 year']
const BOOSTER_YEAR_HINTS = ['booster_1_year', 'booster 1 year', 'guild_boost_12_month']
const QUEST_COMPLETE_HINTS = ['completed_quest', 'quest_completed', 'completed a quest']
const ORBS_APPRENTICE_HINTS = ['orbs_apprentice', 'orbs apprentice']
const DISCORD_POLL_MS = 20000
const STATUS_PULSE_DURATION_MS = 260

function getBadges(flags?: number) {
  if (flags === undefined || flags === null) return []
  return BADGE_MAP.filter((badge) => (flags & badge.bit) === badge.bit)
}

function hasBadgeHint(value: unknown, hints: string[]) {
  const haystack = JSON.stringify(value ?? '').toLowerCase()
  return hints.some((hint) => haystack.includes(hint))
}

function getSpecialBadges(presence?: DiscordPresence) {
  if (!presence?.discord_user) return []
  const user = presence.discord_user
  const kv = presence.kv
  const special = new Set<string>()

  const nitroSince = user.premium_since ? Date.parse(user.premium_since) : NaN
  const hasNitroYear = Number.isFinite(nitroSince) && (Date.now() - nitroSince) >= ONE_YEAR_MS
  if (hasNitroYear || hasBadgeHint({ user, kv }, NITRO_YEAR_HINTS)) {
    special.add(SPECIAL_BADGES.nitro1y)
  }

  const boostSince = user.premium_guild_since ? Date.parse(user.premium_guild_since) : NaN
  const hasBoostYear = Number.isFinite(boostSince) && (Date.now() - boostSince) >= ONE_YEAR_MS
  if (hasBoostYear || hasBadgeHint({ user, kv }, BOOSTER_YEAR_HINTS)) {
    special.add(SPECIAL_BADGES.booster1y)
  }

  if (hasBadgeHint({ user, kv }, QUEST_COMPLETE_HINTS)) {
    special.add(SPECIAL_BADGES.questComplete)
  }

  if (hasBadgeHint({ user, kv }, ORBS_APPRENTICE_HINTS)) {
    special.add(SPECIAL_BADGES.orbsApprentice)
  }

  return [...special]
}

// Activity type 0=Playing, 1=Streaming, 2=Listening, 3=Watching, 4=Custom, 5=Competing
function getActivityCategory(activity: DiscordActivity): string {
  if (activity.type === 2) return 'music'
  if (activity.type === 3 || activity.type === 1) return 'video'
  if (activity.type === 0 || activity.type === 5) return 'games'
  if (activity.type === 4) return 'status'
  return 'other'
}

function DiscordWidget({
  showMusic = true,
  showVideo = true,
  showGames = true,
  showStatus = true,
  showOther = true,
}: DiscordWidgetProps) {
  const [presence, setPresence] = useState<DiscordPresence | null>(null)
  const [loading, setLoading] = useState(true)
  const [isUnavailable, setIsUnavailable] = useState(false)
  const [statusPulse, setStatusPulse] = useState(false)
  const requestInFlightRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const presenceRef = useRef<DiscordPresence | null>(null)
  const previousStatusRef = useRef<DiscordPresence['discord_status'] | null>(null)

  useEffect(() => {
    presenceRef.current = presence
  }, [presence])

  useEffect(() => {
    mountedRef.current = true

    const fetchPresence = async () => {
      if (requestInFlightRef.current) return
      requestInFlightRef.current = true
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/discord', { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          if (!mountedRef.current) return
          setPresence(data)
          setIsUnavailable(false)
        } else {
          setIsUnavailable(true)
        }
      } catch {
        if (!mountedRef.current || controller.signal.aborted) return
        if (!presenceRef.current) setPresence(null)
        setIsUnavailable(true)
      } finally {
        requestInFlightRef.current = false
        if (mountedRef.current) setLoading(false)
      }
    }
    fetchPresence()
    const interval = setInterval(fetchPresence, DISCORD_POLL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const currentStatus = presence?.discord_status
    if (!currentStatus) return
    if (previousStatusRef.current && previousStatusRef.current !== currentStatus) {
      setStatusPulse(true)
      const timeout = setTimeout(() => setStatusPulse(false), STATUS_PULSE_DURATION_MS)
      previousStatusRef.current = currentStatus
      return () => clearTimeout(timeout)
    }
    previousStatusRef.current = currentStatus
  }, [presence?.discord_status])

  const categoryAllowed = (cat: string) => {
    if (cat === 'music') return showMusic
    if (cat === 'video') return showVideo
    if (cat === 'games') return showGames
    if (cat === 'status') return showStatus
    return showOther
  }

  const visibleActivities = presence?.activities?.filter(
    (a) => a.type !== 4 && categoryAllowed(getActivityCategory(a))
  ) ?? []

  const customStatus = presence?.activities?.find((a) => a.type === 4)
  const avatarUrl = getDiscordAvatarUrl(presence?.discord_user)
  const avatarDecorationUrl = getAvatarDecorationUrl(presence?.discord_user)
  const nameplateUrl = getNameplateUrl(presence?.discord_user)
  const bannerUrl = getDiscordBannerUrl(presence?.discord_user)
  const badges = getBadges(presence?.discord_user?.public_flags)
  const specialBadges = getSpecialBadges(presence ?? undefined)
  const serverTag = presence?.discord_user?.primary_guild?.tag ?? presence?.discord_user?.clan?.tag
  const displayName = presence?.discord_user?.username ?? 'coolman_yt'

  return (
    <div className="w-full bg-black/25 rounded-2xl p-3 border border-white/10">
      <div className="flex items-center gap-1.5 mb-2.5">
        <svg className="w-3 h-3 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.101.12 18.143.149 18.17a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.107a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        <span className="text-[#5865F2] text-[10px] font-bold tracking-widest uppercase">Discord Presence</span>
      </div>

      {loading ? (
        <div className="h-8 bg-white/10 rounded-lg animate-pulse" />
      ) : !presence ? (
        isUnavailable ? (
          <p className="text-white/40 text-xs">Unavailable</p>
        ) : (
        <p className="text-white/40 text-xs">Presence unavailable</p>
        )
      ) : (
        <div className="space-y-2">
          {bannerUrl && (
            <div className="relative w-full h-[74px] rounded-xl overflow-hidden border border-white/10 bg-white/5">
              <Image src={bannerUrl} alt="Discord banner" fill className="object-cover" unoptimized />
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/15 bg-white/10 flex-shrink-0">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Discord avatar" fill className="object-cover" unoptimized />
              ) : (
                <span aria-label="Discord avatar placeholder" className="w-full h-full flex items-center justify-center text-[10px] text-white/60">DC</span>
              )}
              {avatarDecorationUrl && (
                <Image src={avatarDecorationUrl} alt="" aria-hidden="true" fill className="object-cover pointer-events-none" unoptimized />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold leading-tight truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusIcon status={presence.discord_status} pulse={statusPulse} />
                <span className="text-white/75 text-[11px]">{STATUS_LABELS[presence.discord_status] || 'Offline'}</span>
                {serverTag && (
                  <span className="text-[10px] text-white/60 border border-white/15 rounded px-1 py-[1px]">
                    {serverTag}
                  </span>
                )}
              </div>
              {nameplateUrl && (
                <div className="mt-1.5 w-[120px] h-5 relative">
                  <Image src={nameplateUrl} alt="Discord nameplate" fill className="object-contain" unoptimized />
                </div>
              )}
            </div>
          </div>

          {(badges.length > 0 || specialBadges.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <Image
                  key={badge.label}
                  src={`https://cdn.discordapp.com/badge-icons/${badge.iconHash}.png`}
                  alt={badge.label}
                  title={badge.label}
                  className="w-4 h-4 rounded-sm"
                  loading="lazy"
                  width={16}
                  height={16}
                  unoptimized
                />
              ))}
              {specialBadges.map((badge) => (
                <span
                  key={badge}
                  className="text-[10px] text-white/75 border border-white/15 rounded px-1.5 py-[2px] bg-black/20"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}

          {/* Custom status row */}
          {showStatus && customStatus?.state && (
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs truncate">{customStatus.state}</span>
            </div>
          )}

          {/* Activity rows */}
          {visibleActivities.map((activity, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex-shrink-0 w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-xs">
                {activity.type === 0 && '🎮'}
                {activity.type === 1 && '📺'}
                {activity.type === 2 && '🎵'}
                {activity.type === 3 && '👀'}
                {activity.type === 5 && '🏆'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate leading-tight">
                  {activity.type === 0 && 'Playing '}
                  {activity.type === 2 && 'Listening to '}
                  {activity.type === 3 && 'Watching '}
                  {activity.name}
                </p>
                {activity.details && (
                  <p className="text-white/50 text-[10px] truncate mt-0.5">{activity.details}</p>
                )}
              </div>
            </div>
          ))}

          {visibleActivities.length === 0 && !showStatus && (
            <p className="text-white/40 text-xs">No visible activity</p>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(DiscordWidget, (prev, next) =>
  prev.showMusic === next.showMusic
  && prev.showVideo === next.showVideo
  && prev.showGames === next.showGames
  && prev.showStatus === next.showStatus
  && prev.showOther === next.showOther
)
