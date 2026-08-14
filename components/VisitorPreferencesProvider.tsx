'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type PerceivedLocation = 'auto' | 'australia' | 'outside-australia'
export type VisitorSimulation = {
  timeZone: string | null
  location: PerceivedLocation
  dateTime: string | null
  dateTimeSetAt: number | null
}
export type TemporaryModule = 'spotify' | 'twitch' | 'discord'
export type TemporaryFeature =
  | 'spotify_widget' | 'spotify_position' | 'spotify_embed' | 'spotify_playlist' | 'spotify_history'
  | 'twitch_profile' | 'twitch_stats' | 'twitch_live' | 'twitch_schedule'
  | 'discord_profile' | 'discord_banner' | 'discord_badges' | 'discord_decoration' | 'discord_devices'
  | 'discord_status' | 'discord_music' | 'discord_video' | 'discord_games' | 'discord_other'
export type MediaPreferences = { showLatestShort: boolean; showLatestLongform: boolean; scheduleTimeZone: string | null }

type VisitorPreferencesValue = {
  simulation: VisitorSimulation
  setSimulation: (next: VisitorSimulation) => void
  hiddenModules: TemporaryModule[]
  setModuleHidden: (module: TemporaryModule, hidden: boolean) => void
  hiddenFeatures: TemporaryFeature[]
  setFeatureHidden: (feature: TemporaryFeature, hidden: boolean) => void
  mediaPreferences: MediaPreferences
  setMediaPreferences: (next: MediaPreferences) => void
}

const DEFAULT_SIMULATION: VisitorSimulation = { timeZone: null, location: 'auto', dateTime: null, dateTimeSetAt: null }
const DEFAULT_MEDIA_PREFERENCES: MediaPreferences = { showLatestShort: false, showLatestLongform: false, scheduleTimeZone: null }
const MEDIA_PREFERENCES_KEY = 'coolman-media-preferences'
const VisitorPreferencesContext = createContext<VisitorPreferencesValue | null>(null)

export default function VisitorPreferencesProvider({ children }: { children: ReactNode }) {
  const [simulation, setSimulation] = useState(DEFAULT_SIMULATION)
  const [hiddenModules, setHiddenModules] = useState<TemporaryModule[]>([])
  const [hiddenFeatures, setHiddenFeatures] = useState<TemporaryFeature[]>([])
  const [mediaPreferences, setMediaPreferencesState] = useState<MediaPreferences>(DEFAULT_MEDIA_PREFERENCES)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(MEDIA_PREFERENCES_KEY) ?? '{}') as Partial<MediaPreferences>
      setMediaPreferencesState({ showLatestShort: stored.showLatestShort === true, showLatestLongform: stored.showLatestLongform === true, scheduleTimeZone: typeof stored.scheduleTimeZone === 'string' ? stored.scheduleTimeZone : null })
    } catch { /* Storage is optional. */ }
  }, [])
  const setModuleHidden = (module: TemporaryModule, hidden: boolean) => {
    setHiddenModules((current) => hidden ? [...new Set([...current, module])] : current.filter((item) => item !== module))
  }
  const setFeatureHidden = (feature: TemporaryFeature, hidden: boolean) => {
    setHiddenFeatures((current) => hidden ? [...new Set([...current, feature])] : current.filter((item) => item !== feature))
  }
  const setMediaPreferences = (next: MediaPreferences) => {
    setMediaPreferencesState(next)
    try { localStorage.setItem(MEDIA_PREFERENCES_KEY, JSON.stringify(next)) } catch { /* Storage is optional. */ }
  }

  return <VisitorPreferencesContext.Provider value={{ simulation, setSimulation, hiddenModules, setModuleHidden, hiddenFeatures, setFeatureHidden, mediaPreferences, setMediaPreferences }}>{children}</VisitorPreferencesContext.Provider>
}

export function useVisitorPreferences() {
  const context = useContext(VisitorPreferencesContext)
  if (!context) throw new Error('useVisitorPreferences must be used within VisitorPreferencesProvider')
  return context
}
