'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { responseErrorCode, useToast } from './ToastProvider'

interface DashboardClientProps {
  initialToggles: Record<string, boolean>
  signOutOnly?: boolean
  onTogglesChange?: (toggles: Record<string, boolean>) => void
}

const TOGGLE_LABELS: Record<string, string> = {
  spotify: 'Entire module',
  spotify_widget: 'Now-playing widget',
  spotify_position: 'Player position and duration',
  spotify_embed: 'Embed Player',
  spotify_playlist: 'Playlist Link',
  spotify_history: 'Listening History',
  twitch: 'Entire module',
  twitch_profile: 'Channel profile and live status',
  twitch_stats: 'Follower and subscriber totals',
  twitch_live: 'Live stream widget',
  twitch_schedule: 'Next scheduled stream',
  youtube: 'Latest YouTube video',
  discord: 'Entire module',
  discord_profile: 'Profile and presence status',
  discord_banner: 'Profile banner',
  discord_badges: 'Profile badges',
  discord_decoration: 'Avatar decoration and nameplate',
  discord_devices: 'Device presence',
  discord_music: 'Music',
  discord_video: 'Video',
  discord_games: 'Games',
  discord_status: 'Custom Status',
  discord_other: 'Other Activity',
  discord_mobile: 'Mobile',
  discord_web: 'Web',
  discord_desktop: 'Desktop',
}

const TOGGLE_GROUPS = [
  { title: 'Spotify', description: 'Control the entire Spotify module or its individual sections.', parentKey: 'spotify', keys: ['spotify', 'spotify_widget', 'spotify_position', 'spotify_embed', 'spotify_playlist', 'spotify_history'] },
  { title: 'Twitch', description: 'Control the entire Twitch module or its channel, stats and stream sections.', parentKey: 'twitch', keys: ['twitch', 'twitch_profile', 'twitch_stats', 'twitch_live', 'twitch_schedule'] },
  { title: 'YouTube', description: 'Show the newest public upload from the COOLmanGamer channel.', parentKey: 'youtube', keys: ['youtube'] },
  { title: 'Discord profile', description: 'Control the entire Discord module or its profile details.', parentKey: 'discord', keys: ['discord', 'discord_profile', 'discord_banner', 'discord_badges', 'discord_decoration', 'discord_devices'] },
  { title: 'Discord Activity', description: 'Choose which Discord activity types appear.', parentKey: 'discord', keys: ['discord_music', 'discord_video', 'discord_games', 'discord_status', 'discord_other'] },
  { title: 'Discord Devices', description: 'Choose which active Discord devices appear.', parentKey: 'discord', keys: ['discord_mobile', 'discord_web', 'discord_desktop'] },
]

export default function DashboardClient({ initialToggles, signOutOnly, onTogglesChange }: DashboardClientProps) {
  const { showToast } = useToast()
  const [toggles, setToggles] = useState(initialToggles)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  if (signOutOnly) {
    return (
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        Sign Out
      </button>
    )
  }

  const handleToggle = async (key: string) => {
    const newValue = !toggles[key]
    setToggles((prev) => {
      const next = { ...prev, [key]: newValue }
      onTogglesChange?.(next)
      return next
    })
    setSaving(key)
    try {
      const response = await fetch('/api/dashboard/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, value: newValue }),
      })
      if (!response.ok) throw new Error(await responseErrorCode(response))
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
      showToast({ variant: 'success', title: `${labelFor(key)} ${newValue ? 'enabled' : 'disabled'}` })
    } catch (error) {
      setToggles((prev) => {
        const next = { ...prev, [key]: !newValue }
        onTogglesChange?.(next)
        return next
      })
      showToast({ variant: 'error', title: 'Could not save profile setting', code: error instanceof Error ? error.message : 'NETWORK_ERROR' })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider">Profile Controls</h2>
      {TOGGLE_GROUPS.map(({ title, description, parentKey, keys }) => (
        <section key={title}>
          <div className="mb-2 px-1">
            <h3 className="text-white text-sm font-semibold">{title}</h3>
            <p className="mt-0.5 text-xs text-white/45">{description}</p>
          </div>
          <div className="space-y-2">
            {keys.map((key) => {
              const label = TOGGLE_LABELS[key]
              const disabledByParent = key !== parentKey && toggles[parentKey] === false
              return (
                <div key={key} className={`flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 transition-opacity ${disabledByParent ? 'opacity-45' : ''}`}>
                  <span className={`text-sm font-medium text-white ${key !== parentKey ? 'pl-3' : ''}`}>{key !== parentKey && <span aria-hidden className="mr-1.5 text-white/35">↳</span>}{label}</span>
                  <div className="flex items-center gap-2">
                    {saved === key && <span className="text-green-400 text-xs">Saved!</span>}
                    <button
                      onClick={() => handleToggle(key)}
                      disabled={saving === key || disabledByParent}
                      aria-label={`${title} — ${label}: ${toggles[key] ? 'enabled' : 'disabled'}`}
                      title={`${label}: ${toggles[key] ? 'enabled' : 'disabled'}`}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        toggles[key] ? 'bg-red-600' : 'bg-white/20'
                      } ${saving === key || disabledByParent ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          toggles[key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function labelFor(key: string) {
  return TOGGLE_LABELS[key] ?? 'Setting'
}
