'use client'

import { useEffect, useState } from 'react'

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
  discord_user?: {
    username: string
    discriminator: string
    avatar?: string
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

const STATUS_COLORS: Record<string, string> = {
  online: '#23a55a',
  idle: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
}

const STATUS_DOT_CLASSES: Record<string, string> = {
  online: 'bg-[#23a55a]',
  idle: 'bg-[#f0b232]',
  dnd: 'bg-[#f23f43]',
  offline: 'bg-[#80848e]',
}

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
}

// Activity type 0=Playing, 1=Streaming, 2=Listening, 3=Watching, 4=Custom, 5=Competing
function getActivityCategory(activity: DiscordActivity): string {
  if (activity.type === 2) return 'music'
  if (activity.type === 3 || activity.type === 1) return 'video'
  if (activity.type === 0 || activity.type === 5) return 'games'
  if (activity.type === 4) return 'status'
  return 'other'
}

export default function DiscordWidget({
  showMusic = true,
  showVideo = true,
  showGames = true,
  showStatus = true,
  showOther = true,
}: DiscordWidgetProps) {
  const [presence, setPresence] = useState<DiscordPresence | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch('/api/discord')
        if (res.ok) {
          const data = await res.json()
          setPresence(data)
        }
      } catch {
        setPresence(null)
      } finally {
        setLoading(false)
      }
    }
    fetchPresence()
    const interval = setInterval(fetchPresence, 30000)
    return () => clearInterval(interval)
  }, [])

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
        <p className="text-white/40 text-xs">Presence unavailable</p>
      ) : (
        <div className="space-y-2">
          {/* Status row */}
          {showStatus && (
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${
                  STATUS_DOT_CLASSES[presence.discord_status] || STATUS_DOT_CLASSES.offline
                }`}
              />
              <span className="text-white/80 text-xs font-medium">
                {STATUS_LABELS[presence.discord_status] || 'Offline'}
              </span>
              {customStatus?.state && (
                <span className="text-white/40 text-xs truncate">— {customStatus.state}</span>
              )}
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
