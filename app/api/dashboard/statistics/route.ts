import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { dashboardAccess } from '@/lib/dashboard-access'
import { getSupabase } from '@/lib/supabase-server'
import { statisticsRange, type ProfileStatistics } from '@/lib/profile-statistics'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(await dashboardAccess(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  }
  const days = statisticsRange(request.nextUrl.searchParams.get('days'))
  if (days === null) return NextResponse.json({ error: 'Choose 7, 30 or 90 days.' }, { status: 400, headers })
  try {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Storage unavailable')
    const { data, error } = await supabase.rpc('get_profile_statistics', { p_days: days })
    if (error || !validStatistics(data, days)) throw new Error('Statistics unavailable')
    return NextResponse.json(data, { headers })
  } catch {
    return NextResponse.json({ error: 'Statistics are unavailable. Check database setup and try again.' }, { status: 503, headers })
  }
}

function validStatistics(value: unknown, days: number): value is ProfileStatistics {
  const data = value as ProfileStatistics | null
  const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
  if (!data || typeof data.trackedSince !== 'string' || !Number.isFinite(Date.parse(data.trackedSince)) || typeof data.generatedAt !== 'string' || !Number.isFinite(Date.parse(data.generatedAt))) return false
  if (!count(data.totals?.views) || !count(data.totals?.likes) || !Array.isArray(data.daily) || data.daily.length !== days * 2) return false
  const today = Date.parse(`${data.generatedAt.slice(0, 10)}T00:00:00Z`)
  return data.daily.every((day, index) => {
    const date = new Date(today - (days * 2 - 1 - index) * 86_400_000).toISOString().slice(0, 10)
    return day?.date === date && (date < data.trackedSince.slice(0, 10)
      ? day.views === null && day.likes === null
      : count(day.views) && count(day.likes))
  })
}
