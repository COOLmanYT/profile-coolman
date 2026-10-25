'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { readVisibility, writeVisibility, resetStoredPreferences } from '@/lib/visitor-preferences.mjs'

export type PerceivedLocation = 'auto' | 'australia' | 'outside-australia'
export type VisitorSimulation = {
  timeZone: string | null
  location: PerceivedLocation
  dateTime: string | null
  dateTimeSetAt: number | null
}
export type TemporaryModule = 'spotify' | 'twitch' | 'discord' | 'youtube' | 'roblox' | 'steam' | 'buymeacoffee' | 'github' | 'announcement'
export type TemporaryFeature =
  | 'github_status' | 'github_profile' | 'github_stats' | 'github_commits' | 'github_graph' | 'github_projects' | 'github_commit_titles' | 'github_language' | 'github_licence'
  | `${'roblox' | 'steam' | 'buymeacoffee'}_${string}`
  | 'roblox_stats' | 'steam_activity'
  | 'spotify_widget' | 'spotify_position' | 'spotify_embed' | 'spotify_playlist' | 'spotify_history'
  | 'twitch_profile' | 'twitch_stats' | 'twitch_live' | 'twitch_schedule' | 'twitch_takeover'
  | 'discord_profile' | 'discord_banner' | 'discord_badges' | 'discord_decoration' | 'discord_devices'
  | 'discord_status' | 'discord_music' | 'discord_video' | 'discord_games' | 'discord_other'
export type YoutubeFormat = 'both' | 'shorts' | 'videos'
export type MediaPreferences = { showYoutube: boolean; showYoutubeStats: boolean; showLatestUpload: boolean; showYoutubeLive: boolean; youtubeFormat: YoutubeFormat; youtubeEmbed: 'default' | 'on' | 'off'; scheduleTimeZone: string | null }

type VisitorPreferencesValue = {
  visibilityLoaded: boolean
  simulation: VisitorSimulation
  setSimulation: (next: VisitorSimulation) => void
  hiddenModules: TemporaryModule[]
  setModuleHidden: (module: TemporaryModule, hidden: boolean) => void
  hiddenFeatures: TemporaryFeature[]
  setFeatureHidden: (feature: TemporaryFeature, hidden: boolean) => void
  mediaPreferences: MediaPreferences
  setMediaPreferences: (next: MediaPreferences) => void
  resetPreferences: () => void
}

const DEFAULT_SIMULATION: VisitorSimulation = { timeZone: null, location: 'auto', dateTime: null, dateTimeSetAt: null }
const DEFAULT_MEDIA_PREFERENCES: MediaPreferences = { showYoutube: true, showYoutubeStats: true, showLatestUpload: true, showYoutubeLive: true, youtubeFormat: 'both', youtubeEmbed: 'default', scheduleTimeZone: null }
const MEDIA_PREFERENCES_KEY = 'coolman-media-preferences'
const VisitorPreferencesContext = createContext<VisitorPreferencesValue | null>(null)

export default function VisitorPreferencesProvider({ children }: { children: ReactNode }) {
  const [simulation, setSimulation] = useState(DEFAULT_SIMULATION)
  const [hiddenModules, setHiddenModules] = useState<TemporaryModule[]>([])
  const [hiddenFeatures, setHiddenFeatures] = useState<TemporaryFeature[]>([])
  const [visibilityLoaded, setVisibilityLoaded] = useState(false)
  const visibility = useRef({ hiddenModules: [] as TemporaryModule[], hiddenFeatures: [] as TemporaryFeature[] })
  const [mediaPreferences, setMediaPreferencesState] = useState<MediaPreferences>(DEFAULT_MEDIA_PREFERENCES)
  useEffect(() => {
    try {
      const storedVisibility = readVisibility(localStorage)
      visibility.current = { hiddenModules: storedVisibility.hiddenModules as TemporaryModule[], hiddenFeatures: storedVisibility.hiddenFeatures as TemporaryFeature[] }
      setHiddenModules(visibility.current.hiddenModules)
      setHiddenFeatures(visibility.current.hiddenFeatures)
    } catch { /* Storage is optional. */ }
    setVisibilityLoaded(true)
    try {
      const stored = JSON.parse(localStorage.getItem(MEDIA_PREFERENCES_KEY) ?? '{}') as Partial<MediaPreferences>
      setMediaPreferencesState({ showYoutube: stored.showYoutube !== false, showYoutubeStats: stored.showYoutubeStats !== false, showLatestUpload: stored.showLatestUpload !== false, showYoutubeLive: stored.showYoutubeLive !== false, youtubeFormat: stored.youtubeFormat === 'shorts' || stored.youtubeFormat === 'videos' ? stored.youtubeFormat : 'both', youtubeEmbed: stored.youtubeEmbed === 'on' || stored.youtubeEmbed === 'off' ? stored.youtubeEmbed : 'default', scheduleTimeZone: typeof stored.scheduleTimeZone === 'string' ? stored.scheduleTimeZone : null })
    } catch { /* Storage is optional. */ }
  }, [])
  const setModuleHidden = (module: TemporaryModule, hidden: boolean) => {
    const next = hidden ? [...new Set([...visibility.current.hiddenModules, module])] : visibility.current.hiddenModules.filter((item) => item !== module)
    visibility.current = { ...visibility.current, hiddenModules: next }
    setHiddenModules(next)
    try { writeVisibility(localStorage, visibility.current) } catch { /* Storage is optional. */ }
  }
  const setFeatureHidden = (feature: TemporaryFeature, hidden: boolean) => {
    const next = hidden ? [...new Set([...visibility.current.hiddenFeatures, feature])] : visibility.current.hiddenFeatures.filter((item) => item !== feature)
    visibility.current = { ...visibility.current, hiddenFeatures: next }
    setHiddenFeatures(next)
    try { writeVisibility(localStorage, visibility.current) } catch { /* Storage is optional. */ }
  }
  const setMediaPreferences = (next: MediaPreferences) => {
    setMediaPreferencesState(next)
    try { localStorage.setItem(MEDIA_PREFERENCES_KEY, JSON.stringify(next)) } catch { /* Storage is optional. */ }
  }

  const resetPreferences = () => {
    try { resetStoredPreferences(localStorage, sessionStorage) } catch { /* Storage is optional. */ }
    visibility.current = { hiddenModules: [], hiddenFeatures: [] }
    setHiddenModules([])
    setHiddenFeatures([])
    setMediaPreferencesState(DEFAULT_MEDIA_PREFERENCES)
    setSimulation(DEFAULT_SIMULATION)
  }

  return <VisitorPreferencesContext.Provider value={{ visibilityLoaded, simulation, setSimulation, hiddenModules, setModuleHidden, hiddenFeatures, setFeatureHidden, mediaPreferences, setMediaPreferences, resetPreferences }}>{children}</VisitorPreferencesContext.Provider>
}

export function useVisitorPreferences() {
  const context = useContext(VisitorPreferencesContext)
  if (!context) throw new Error('useVisitorPreferences must be used within VisitorPreferencesProvider')
  return context
}
