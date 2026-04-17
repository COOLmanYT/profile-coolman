'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'

interface DashboardClientProps {
  initialToggles: Record<string, boolean>
  signOutOnly?: boolean
}

const TOGGLE_LABELS: Record<string, string> = {
  spotify: 'Spotify Widget',
  spotify_embed: 'Spotify Embed Player',
  spotify_playlist: 'Spotify Playlist Link',
  discord_music: 'Discord — Music',
  discord_video: 'Discord — Video',
  discord_games: 'Discord — Games',
  discord_status: 'Discord — Status',
  discord_other: 'Discord — Other',
}

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
      await fetch('/api/dashboard/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, value: newValue }),
      })
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } catch {
      setToggles((prev) => ({ ...prev, [key]: !newValue }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-4">Widget Toggles</h2>
      {Object.entries(TOGGLE_LABELS).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between py-3 px-4 bg-white/5 rounded-xl">
          <span className="text-white text-sm font-medium">{label}</span>
          <div className="flex items-center gap-2">
            {saved === key && (
              <span className="text-green-400 text-xs">Saved!</span>
            )}
            <button
              onClick={() => handleToggle(key)}
              disabled={saving === key}
              aria-label={`${label}: ${toggles[key] ? 'enabled' : 'disabled'}`}
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
      ))}
    </div>
  )
}
