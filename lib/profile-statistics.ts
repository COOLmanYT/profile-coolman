export type DailyStatistic = { date: string; views: number | null; likes: number | null }
export type ProfileStatistics = {
  trackedSince: string
  generatedAt: string
  totals: { views: number; likes: number }
  daily: DailyStatistic[]
}

const DAY = 86_400_000
export const STATISTIC_RANGES = [7, 30, 90] as const

export function statisticsRange(value: string | null) {
  const days = Number(value ?? 30)
  return STATISTIC_RANGES.includes(days as 7 | 30 | 90) ? days : null
}

// A single UTC timeline keeps charts stable across browser time zones and DST.
export function summarizeStatistics(data: ProfileStatistics, days: number) {
  const today = data.generatedAt.slice(0, 10)
  const start = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY).toISOString().slice(0, 10)
  const previousStart = new Date(Date.parse(`${start}T00:00:00Z`) - days * DAY).toISOString().slice(0, 10)
  const firstDay = data.trackedSince.slice(0, 10)
  const current = data.daily.filter(day => day.date >= start && day.date <= today)
  const previous = data.daily.filter(day => day.date >= previousStart && day.date < start)
  const sum = (rows: DailyStatistic[], metric: 'views' | 'likes') => rows.reduce((total, day) => total + (day[metric] ?? 0), 0)
  // Compare equal, completed UTC days. Today and the installation day are partial.
  const completed = current.filter(day => day.date < today && day.date > firstDay)
  const comparable = previousStart > firstDay && previous.length === days && completed.length === days - 1
  const change = (metric: 'views' | 'likes') => {
    if (!comparable) return null
    const before = sum(previous.slice(0, -1), metric)
    return before > 0 ? ((sum(completed, metric) - before) / before) * 100 : null
  }
  const best = (metric: 'views' | 'likes') => completed.reduce<DailyStatistic | null>((winner, day) => (day[metric] ?? 0) > (winner?.[metric] ?? 0) ? day : winner, null)
  const views = sum(current, 'views'), likes = sum(current, 'likes')
  return {
    current, views, likes, viewsChange: change('views'), likesChange: change('likes'),
    recordedDays: current.filter(day => day.views !== null).length,
    averageViews: completed.length ? sum(completed, 'views') / completed.length : null,
    bestViews: best('views'), bestLikes: best('likes'),
    likesPerHundredViews: views > 0 ? (likes / views) * 100 : null,
  }
}
