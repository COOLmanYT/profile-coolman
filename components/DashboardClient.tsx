'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'

interface DashboardClientProps {
  initialToggles: Record<string, boolean>
  signOutOnly?: boolean
}

const TOGGLE_LABELS: Record<string, string> = {
  spotify: 'Widget',
  spotify_embed: 'Embed Player',
  spotify_playlist: 'Playlist Link',
  twitch: 'Live Widget',
  twitch_stats: 'Stream Statistics',
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
  { title: 'Spotify', description: 'Control the Spotify card and its links.', keys: ['spotify', 'spotify_embed', 'spotify_playlist'] },
  { title: 'Twitch', description: 'Show your live stream and its audience statistics.', keys: ['twitch', 'twitch_stats'] },
  { title: 'Discord Activity', description: 'Choose which Discord activity types appear.', keys: ['discord_music', 'discord_video', 'discord_games', 'discord_status', 'discord_other'] },
  { title: 'Discord Devices', description: 'Choose which active Discord devices appear.', keys: ['discord_mobile', 'discord_web', 'discord_desktop'] },
]

export default function DashboardClient({ initialToggles, signOutOnly }: DashboardClientProps) {
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
    setToggles((prev) => ({ ...prev, [key]: newValue }))
    setSaving(key)
    try {
      const response = await fetch('/api/dashboard/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, value: newValue }),
      })
      if (!response.ok) throw new Error('Unable to save toggle')
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } catch {
      setToggles((prev) => ({ ...prev, [key]: !newValue }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider">Profile Controls</h2>
      {TOGGLE_GROUPS.map(({ title, description, keys }) => (
        <section key={title}>
          <div className="mb-2 px-1">
            <h3 className="text-white text-sm font-semibold">{title}</h3>
            <p className="mt-0.5 text-xs text-white/45">{description}</p>
          </div>
          <div className="space-y-2">
            {keys.map((key) => {
              const label = TOGGLE_LABELS[key]
              return (
                <div key={key} className="flex items-center justify-between py-3 px-4 bg-white/5 rounded-xl">
                  <span className="text-white text-sm font-medium">{label}</span>
                  <div className="flex items-center gap-2">
                    {saved === key && <span className="text-green-400 text-xs">Saved!</span>}
                    <button
                      onClick={() => handleToggle(key)}
                      disabled={saving === key}
                      aria-label={`${title} — ${label}: ${toggles[key] ? 'enabled' : 'disabled'}`}
                      title={`${label}: ${toggles[key] ? 'enabled' : 'disabled'}`}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        toggles[key] ? 'bg-red-600' : 'bg-white/20'
                      } ${saving === key ? 'opacity-50 cursor-not-allowed' : ''}`}
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
