'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isAustralia, isSeasonalTheme, resolveGlobalTheme, type SeasonalSettings, type SeasonalTheme } from '@/lib/seasonal'

export type PersonalThemePreference = {
  theme: SeasonalTheme | null
  until: string | null
}

type SeasonalThemeContextValue = {
  theme: SeasonalTheme | null
  timeZone: string
  australian: boolean
  preference: PersonalThemePreference
  setPreference: (preference: PersonalThemePreference) => void
  activateOnce: (theme: SeasonalTheme) => void
}

const PREFERENCE_KEY = 'coolman-seasonal-preference'
const ONCE_KEY = 'coolman-seasonal-once'
const SeasonalThemeContext = createContext<SeasonalThemeContextValue | null>(null)

function readPreference(): PersonalThemePreference {
  try {
    const value = JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? '{}') as Partial<PersonalThemePreference>
    return { theme: isSeasonalTheme(value.theme) ? value.theme : null, until: typeof value.until === 'string' ? value.until : null }
  } catch {
    return { theme: null, until: null }
  }
}

function readOnceTheme() {
  try {
    const theme = sessionStorage.getItem(ONCE_KEY)
    return isSeasonalTheme(theme) ? theme : null
  } catch {
    return null
  }
}

export default function SeasonalThemeProvider({ settings, children }: { settings: SeasonalSettings; children: ReactNode }) {
  const [now, setNow] = useState(() => new Date())
  const [preference, setPreferenceState] = useState<PersonalThemePreference>({ theme: null, until: null })
  const [onceTheme, setOnceTheme] = useState<SeasonalTheme | null>(null)
  const [timeZone, setTimeZone] = useState('UTC')

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    setPreferenceState(readPreference())
    setOnceTheme(readOnceTheme())
    const timer = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const setPreference = (next: PersonalThemePreference) => {
    const normalised = { theme: next.theme, until: next.until }
    setPreferenceState(normalised)
    try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify(normalised)) } catch { /* Storage is optional. */ }
  }

  const activateOnce = (theme: SeasonalTheme) => {
    setOnceTheme(theme)
    try { sessionStorage.setItem(ONCE_KEY, theme) } catch { /* Storage is optional. */ }
  }

  const theme = useMemo(() => {
    if (onceTheme) return onceTheme
    if (preference.theme && preference.until && Date.parse(preference.until) > now.getTime()) return preference.theme
    return resolveGlobalTheme(settings, now, timeZone)
  }, [now, onceTheme, preference, settings, timeZone])

  return (
    <SeasonalThemeContext.Provider value={{ theme, timeZone, australian: isAustralia(timeZone), preference, setPreference, activateOnce }}>
      {children}
    </SeasonalThemeContext.Provider>
  )
}

export function useSeasonalTheme() {
  const context = useContext(SeasonalThemeContext)
  if (!context) throw new Error('useSeasonalTheme must be used within SeasonalThemeProvider')
  return context
}
