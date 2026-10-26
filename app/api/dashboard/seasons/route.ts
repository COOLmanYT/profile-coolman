import { dashboardAccess } from '@/lib/dashboard-access'
import { isModuleAvailable, siteConfig } from '@/lib/site-config.mjs'
import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normaliseSeasonalSettings } from '@/lib/seasonal'
import { saveSeasonalSettings } from '@/lib/site-settings'


export async function POST(req: NextRequest) {
  if (!isModuleAvailable('seasons') || !siteConfig.dashboard.features.seasons) return NextResponse.json({ error: 'MODULE_DISABLED' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const session = await getServerSession(authOptions)
  if (!(await dashboardAccess(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const raw = await req.json()
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NextResponse.json({ error: 'Invalid seasonal settings' }, { status: 400 })
    const settings = normaliseSeasonalSettings(raw)
    if (raw?.scheduledTheme && (!settings.scheduledTheme || !settings.scheduledStartsAt || !settings.scheduledEndsAt || !Number.isFinite(Date.parse(settings.scheduledStartsAt)) || !Number.isFinite(Date.parse(settings.scheduledEndsAt)) || Date.parse(settings.scheduledStartsAt) >= Date.parse(settings.scheduledEndsAt))) return NextResponse.json({ error: 'Choose a valid event and a start before the end' }, { status: 400 })
    if (!(await saveSeasonalSettings(settings))) return NextResponse.json({ error: 'Unable to save settings' }, { status: 500 })
    revalidatePath('/')
    revalidatePath('/options')
    return NextResponse.json({ ok: true, settings })
  } catch {
    return NextResponse.json({ error: 'Invalid seasonal settings' }, { status: 400 })
  }
}
