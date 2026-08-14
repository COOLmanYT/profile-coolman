export const SEASONAL_THEMES = ['christmas', 'halloween', 'easter', 'new-year', 'birthday'] as const
export type SeasonalTheme = (typeof SEASONAL_THEMES)[number]
export type ThemeLocation = 'anywhere' | 'australia' | 'outside-australia'

export type SeasonalSettings = {
  automaticEnabled: boolean
  scheduledTheme: SeasonalTheme | null
  scheduledStartsAt: string | null
  scheduledEndsAt: string | null
  scheduledLocation: ThemeLocation
}

export const DEFAULT_SEASONAL_SETTINGS: SeasonalSettings = {
  automaticEnabled: true,
  scheduledTheme: null,
  scheduledStartsAt: null,
  scheduledEndsAt: null,
  scheduledLocation: 'anywhere',
}

export function isSeasonalTheme(value: unknown): value is SeasonalTheme {
  return typeof value === 'string' && (SEASONAL_THEMES as readonly string[]).includes(value)
}

export function isThemeLocation(value: unknown): value is ThemeLocation {
  return value === 'anywhere' || value === 'australia' || value === 'outside-australia'
}

export function normaliseSeasonalSettings(value: unknown): SeasonalSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    automaticEnabled: record.automaticEnabled !== false,
    scheduledTheme: isSeasonalTheme(record.scheduledTheme) ? record.scheduledTheme : null,
    scheduledStartsAt: typeof record.scheduledStartsAt === 'string' ? record.scheduledStartsAt : null,
    scheduledEndsAt: typeof record.scheduledEndsAt === 'string' ? record.scheduledEndsAt : null,
    scheduledLocation: isThemeLocation(record.scheduledLocation) ? record.scheduledLocation : 'anywhere',
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
  if (current.month === 11 && current.day === 28) return 'birthday'

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
  if (scheduledActive) return settings.scheduledTheme
  return settings.automaticEnabled ? automaticThemeAt(date, timeZone) : null
}
