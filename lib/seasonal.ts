import { siteConfig } from './site-config.mjs'
const ALL_THEMES = ['christmas', 'halloween', 'easter', 'new-year', 'birthday'] as const
export type SeasonalTheme = (typeof ALL_THEMES)[number]
export const SEASONAL_THEMES = ALL_THEMES.filter(theme => siteConfig.seasonal.availableThemes[theme])
export type ThemeLocation = 'anywhere' | 'australia' | 'outside-australia'

export type SeasonalSettings = {
  enabledThemes: SeasonalTheme[]
  automaticEnabled: boolean
  scheduledTheme: SeasonalTheme | null
  scheduledStartsAt: string | null
  scheduledEndsAt: string | null
  scheduledLocation: ThemeLocation
}

export const DEFAULT_SEASONAL_SETTINGS: SeasonalSettings = {
  enabledThemes: SEASONAL_THEMES.filter(theme => siteConfig.seasonal.defaults.enabledThemes.includes(theme)),
  automaticEnabled: siteConfig.seasonal.defaults.automaticEnabled,
  scheduledTheme: siteConfig.seasonal.defaults.scheduledTheme as SeasonalTheme | null,
  scheduledStartsAt: siteConfig.seasonal.defaults.scheduledStartsAt,
  scheduledEndsAt: siteConfig.seasonal.defaults.scheduledEndsAt,
  scheduledLocation: siteConfig.seasonal.defaults.scheduledLocation as ThemeLocation,
}

export function isSeasonalTheme(value: unknown): value is SeasonalTheme {
  return typeof value === 'string' && (SEASONAL_THEMES as readonly string[]).includes(value)
}

export function isThemeLocation(value: unknown): value is ThemeLocation {
  return value === 'anywhere' || value === 'australia' || value === 'outside-australia'
}

export function normaliseSeasonalSettings(value: unknown): SeasonalSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const enabledThemes = record.enabledThemes
  const allowed = Array.isArray(enabledThemes) ? SEASONAL_THEMES.filter(theme => enabledThemes.includes(theme)) : [...DEFAULT_SEASONAL_SETTINGS.enabledThemes]
  const scheduled = record.scheduledTheme === undefined ? DEFAULT_SEASONAL_SETTINGS.scheduledTheme : isSeasonalTheme(record.scheduledTheme) ? record.scheduledTheme : null
  return {
    enabledThemes: allowed,
    automaticEnabled: typeof record.automaticEnabled === 'boolean' ? record.automaticEnabled : DEFAULT_SEASONAL_SETTINGS.automaticEnabled,
    scheduledTheme: scheduled && allowed.includes(scheduled) ? scheduled : null,
    scheduledStartsAt: record.scheduledStartsAt === null ? null : typeof record.scheduledStartsAt === 'string' ? record.scheduledStartsAt : DEFAULT_SEASONAL_SETTINGS.scheduledStartsAt,
    scheduledEndsAt: record.scheduledEndsAt === null ? null : typeof record.scheduledEndsAt === 'string' ? record.scheduledEndsAt : DEFAULT_SEASONAL_SETTINGS.scheduledEndsAt,
    scheduledLocation: isThemeLocation(record.scheduledLocation) ? record.scheduledLocation : DEFAULT_SEASONAL_SETTINGS.scheduledLocation,
  }
}

function getDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second }
}

function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return Date.UTC(year, month - 1, day)
}

export function isAustralia(timeZone: string) {
  return timeZone.startsWith('Australia/')
}

function matchesLocation(location: ThemeLocation, timeZone: string, perceivedLocation: ThemeLocation = 'anywhere') {
  if (location === 'anywhere') return true
  const visitorIsAustralian = perceivedLocation === 'anywhere' ? isAustralia(timeZone) : perceivedLocation === 'australia'
  return location === 'australia' ? visitorIsAustralian : !visitorIsAustralian
}

export function automaticThemeAt(date: Date, timeZone: string): SeasonalTheme | null {
  const current = getDateParts(date, timeZone)
  if (current.month === 1 && current.day === 1) return 'new-year'
  if (current.month === 12 && current.day === 31 && current.hour === 23 && current.minute === 59 && current.second >= 50) return 'new-year'
  if (current.month === 12 && current.day >= 22 && current.day <= 28) return 'christmas'
  if (current.month === 10 && current.day === 31) return 'halloween'
  if (current.month === siteConfig.profile.birthday.month && current.day === siteConfig.profile.birthday.day) return 'birthday'

  const today = Date.UTC(current.year, current.month - 1, current.day)
  const daysFromEaster = Math.round((today - easterSunday(current.year)) / 86_400_000)
  return daysFromEaster >= -2 && daysFromEaster <= 1 ? 'easter' : null
}

export function resolveGlobalTheme(settings: SeasonalSettings, date: Date, timeZone: string, perceivedLocation: ThemeLocation = 'anywhere') {
  const startsAt = settings.scheduledStartsAt ? Date.parse(settings.scheduledStartsAt) : Number.NaN
  const endsAt = settings.scheduledEndsAt ? Date.parse(settings.scheduledEndsAt) : Number.NaN
  const scheduledActive = settings.scheduledTheme
    && Number.isFinite(startsAt)
    && Number.isFinite(endsAt)
    && date.getTime() >= startsAt
    && date.getTime() <= endsAt
    && matchesLocation(settings.scheduledLocation, timeZone, perceivedLocation)
  const allowed = (settings.enabledThemes ?? DEFAULT_SEASONAL_SETTINGS.enabledThemes).filter(isSeasonalTheme)
  if (scheduledActive && allowed.includes(settings.scheduledTheme!)) return settings.scheduledTheme
  const automatic = settings.automaticEnabled ? automaticThemeAt(date, timeZone) : null
  return automatic && allowed.includes(automatic) ? automatic : null
}
