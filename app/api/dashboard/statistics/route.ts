import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { dashboardAccess } from '@/lib/dashboard-access'
import { getSupabase } from '@/lib/supabase-server'
import { customStatisticsRange, statisticsRange, type ProfileStatistics } from '@/lib/profile-statistics'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(await dashboardAccess(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  }
  const params = request.nextUrl.searchParams
  const hasCustom = params.has('start') || params.has('end')
  const custom = hasCustom ? customStatisticsRange(params.get('start') ?? '', params.get('end') ?? '') : null
  const days = hasCustom ? custom?.days ?? null : statisticsRange(params.get('days'))
  if (days === null || (hasCustom && params.has('days'))) return NextResponse.json({ error: 'Choose a preset or valid start/end dates, up to 366 days, ending no later than today (UTC).' }, { status: 400, headers })
  try {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Storage unavailable')
    const { data, error } = await supabase.rpc('get_profile_statistics', custom ? { p_start: custom.start, p_end: custom.end } : { p_days: days })
    if (error || !validStatistics(data, days, custom)) throw new Error('Statistics unavailable')
    return NextResponse.json(data, { headers })
  } catch {
    return NextResponse.json({ error: 'Statistics are unavailable. Check database setup and try again.' }, { status: 503, headers })
  }
}

function validStatistics(value: unknown, days: number, custom: { start: string; end: string } | null): value is ProfileStatistics {
  const data = value as ProfileStatistics | null
  const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
  if (!data || typeof data.trackedSince !== 'string' || !Number.isFinite(Date.parse(data.trackedSince)) || typeof data.generatedAt !== 'string' || !Number.isFinite(Date.parse(data.generatedAt))) return false
  if (!count(data.totals?.views) || !count(data.totals?.likes) || !Array.isArray(data.daily) || data.daily.length !== days * 2) return false
  const end = custom?.end ?? data.generatedAt.slice(0, 10)
  const start = new Date(Date.parse(`${end}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10)
  if (data.range?.start !== start || data.range?.end !== end) return false
  return data.daily.every((day, index) => {
    const date = new Date(Date.parse(`${end}T00:00:00Z`) - (days * 2 - 1 - index) * 86_400_000).toISOString().slice(0, 10)
    return day?.date === date && (date < data.trackedSince.slice(0, 10)
      ? day.views === null && day.likes === null
      : count(day.views) && count(day.likes))
  })
}
