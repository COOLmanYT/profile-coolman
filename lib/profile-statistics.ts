export type DailyStatistic = { date: string; views: number | null; likes: number | null }
export type ProfileStatistics = {
  trackedSince: string
  generatedAt: string
  totals: { views: number; likes: number }
  daily: DailyStatistic[]
  range: { start: string; end: string }
}

const DAY = 86_400_000
export const STATISTIC_RANGES = [7, 30, 90] as const
export const MAX_STATISTIC_DAYS = 366

export function customStatisticsRange(start: string, end: string, today = new Date().toISOString().slice(0, 10)) {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  if (!validDate(start) || !validDate(end) || start < '2000-01-01' || end > today || start > end) return null
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY + 1
  return days <= MAX_STATISTIC_DAYS ? { start, end, days } : null
}

export function statisticsRange(value: string | null) {
  const days = Number(value ?? 30)
  return STATISTIC_RANGES.includes(days as 7 | 30 | 90) ? days : null
}

// A single UTC timeline keeps charts stable across browser time zones and DST.
export function summarizeStatistics(data: ProfileStatistics) {
  const today = data.generatedAt.slice(0, 10)
  const { start, end } = data.range
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY + 1
  const firstDay = data.trackedSince.slice(0, 10)
  const current = data.daily.filter(day => day.date >= start && day.date <= end)
  const byDate = new Map(data.daily.map(day => [day.date, day]))
  const sum = (rows: DailyStatistic[], metric: 'views' | 'likes') => rows.reduce((total, day) => total + (day[metric] ?? 0), 0)
  // Compare equal, completed UTC days. Today and the installation day are partial.
  const completed = current.filter(day => day.date < today && day.date > firstDay)
  const previous = completed.map(day => byDate.get(new Date(Date.parse(`${day.date}T00:00:00Z`) - days * DAY).toISOString().slice(0, 10)))
  const comparable = completed.length > 0 && completed.length === days - (end === today ? 1 : 0) && previous.every(day => day && day.date > firstDay && day.views !== null && day.likes !== null)
  const change = (metric: 'views' | 'likes') => {
    if (!comparable) return null
    const before = sum(previous as DailyStatistic[], metric)
    return before > 0 ? ((sum(completed, metric) - before) / before) * 100 : null
  }
  const best = (metric: 'views' | 'likes') => completed.reduce<DailyStatistic | null>((winner, day) => (day[metric] ?? 0) > (winner?.[metric] ?? 0) ? day : winner, null)
  const views = sum(current, 'views'), likes = sum(current, 'likes')
  const sortedViews = completed.map(day => day.views!).sort((a, b) => a - b)
  const middle = Math.floor(sortedViews.length / 2)
  const medianViews = sortedViews.length ? (sortedViews[middle] + sortedViews[Math.floor((sortedViews.length - 1) / 2)]) / 2 : null
  const activeDays = completed.filter(day => day.views! > 0).length
  let streak = 0, longestStreak = 0
  for (const day of completed) {
    streak = day.views! > 0 ? streak + 1 : 0
    longestStreak = Math.max(longestStreak, streak)
  }
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(label => ({ label, samples: 0, total: 0, average: null as number | null }))
  for (const day of completed) {
    const weekday = weekdays[(new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7]
    weekday.samples++
    weekday.total += day.views!
  }
  for (const weekday of weekdays) weekday.average = weekday.samples ? weekday.total / weekday.samples : null
  const weekdayReady = weekdays.every(day => day.samples >= 2)
  const weekdayMax = Math.max(0, ...weekdays.map(day => day.average ?? 0))
  const leaders = weekdays.filter(day => day.average === weekdayMax)
  const completeViews = sum(completed, 'views')
  return {
    current, days, views, likes, viewsChange: change('views'), likesChange: change('likes'),
    recordedDays: current.filter(day => day.views !== null).length,
    averageViews: completed.length ? sum(completed, 'views') / completed.length : null,
    bestViews: best('views'), bestLikes: best('likes'),
    likesPerHundredViews: views > 0 ? (likes / views) * 100 : null,
    completedDays: completed.length, activeDays, longestStreak, medianViews, weekdays, weekdayReady,
    strongestWeekday: weekdayReady && weekdayMax > 0 && leaders.length === 1 ? leaders[0] : null,
    peakShare: completeViews > 0 ? ((best('views')?.views ?? 0) / completeViews) * 100 : null,
  }
}
