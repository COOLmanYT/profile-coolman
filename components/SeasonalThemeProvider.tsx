'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isAustralia, isSeasonalTheme, resolveGlobalTheme, type SeasonalSettings, type SeasonalTheme } from '@/lib/seasonal'
import { useVisitorPreferences } from './VisitorPreferencesProvider'

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
  clearOnce: () => void
}

const PREFERENCE_KEY = 'coolman-seasonal-preference'
const ONCE_KEY = 'coolman-seasonal-once'

function parseLocalDateTimeInTimeZone(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const expectedUtc = Date.UTC(year, month - 1, day, hour, minute)
  const getOffset = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date)
    const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
    return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute) - date.getTime()
  }
  let timestamp = expectedUtc - getOffset(new Date(expectedUtc))
  timestamp = expectedUtc - getOffset(new Date(timestamp))
  return new Date(timestamp)
}
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
  const { simulation } = useVisitorPreferences()

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

  const effectiveTimeZone = useMemo(() => {
    if (!simulation.timeZone) return timeZone
    try {
      new Intl.DateTimeFormat('en', { timeZone: simulation.timeZone }).format()
      return simulation.timeZone
    } catch {
      return timeZone
    }
  }, [simulation.timeZone, timeZone])
  const effectiveNow = useMemo(() => {
    if (!simulation.dateTime || !simulation.dateTimeSetAt) return now
    const startingDate = parseLocalDateTimeInTimeZone(simulation.dateTime, effectiveTimeZone)
    return startingDate ? new Date(startingDate.getTime() + (Date.now() - simulation.dateTimeSetAt)) : now
  }, [effectiveTimeZone, now, simulation.dateTime, simulation.dateTimeSetAt])
  const perceivedLocation = simulation.location === 'auto' ? 'anywhere' : simulation.location
  const australian = simulation.location === 'auto' ? isAustralia(effectiveTimeZone) : simulation.location === 'australia'

  const theme = useMemo(() => {
    if (onceTheme) return onceTheme
    if (preference.theme && preference.until && Date.parse(preference.until) > effectiveNow.getTime()) return preference.theme
    return resolveGlobalTheme(settings, effectiveNow, effectiveTimeZone, perceivedLocation)
  }, [effectiveNow, effectiveTimeZone, onceTheme, perceivedLocation, preference, settings])

  return (
    <SeasonalThemeContext.Provider value={{ theme, timeZone: effectiveTimeZone, australian, preference, setPreference, activateOnce, clearOnce: () => { setOnceTheme(null); try { sessionStorage.removeItem(ONCE_KEY) } catch {} } }}>
      {children}
    </SeasonalThemeContext.Provider>
  )
}

export function useSeasonalTheme() {
  const context = useContext(SeasonalThemeContext)
  if (!context) throw new Error('useSeasonalTheme must be used within SeasonalThemeProvider')
  return context
}
