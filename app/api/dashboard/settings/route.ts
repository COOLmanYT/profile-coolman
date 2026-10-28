import { dashboardAccess } from '@/lib/dashboard-access'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { siteConfig, isModuleAvailable } from '@/lib/site-config.mjs'
import { normaliseLayout, validLayout } from '@/lib/layout-order.mjs'
import { readAnnouncement } from '@/lib/live-announcement.mjs'
import { writeDashboardSetting } from '@/lib/dashboard-settings'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(await dashboardAccess(session))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let payload
  try { payload = await req.json() } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }) }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  let value: unknown, key: string
  if (payload?.type === 'layout' && siteConfig.dashboard.features.ordering) {
    if (!validLayout(payload.value)) return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
    value = normaliseLayout(payload.value); key = 'profile-layout'
  } else if (payload?.type === 'announcement' && siteConfig.dashboard.features.announcements && isModuleAvailable('announcement') && siteConfig.announcement.source !== 'lanyard') {
    const message = payload.value?.message, url = payload.value?.url
    const { label, linkText, placement } = payload.value ?? {}
    if (typeof message !== 'string' || message.length > 280 || typeof url !== 'string' || url.length > 2048) return NextResponse.json({ error: 'Invalid announcement' }, { status: 400 })
    if ([label, linkText].some(text => text !== undefined && (typeof text !== 'string' || text.length > 80)) || (placement !== undefined && !['card', 'bar'].includes(placement))) return NextResponse.json({ error: 'Invalid announcement options' }, { status: 400 })
    const announcement = readAnnouncement({ announcement: message, announcement_url: url, announcement_label: label, announcement_link_text: linkText, announcement_placement: placement })
    if (url.trim() && (!announcement || !announcement.url)) return NextResponse.json({ error: 'Use an HTTPS link with a message' }, { status: 400 })
    value = announcement ? { ...announcement, url: announcement.url ?? '' } : { message: '', url: '' }; key = 'profile-announcement'
  } else return NextResponse.json({ error: 'Setting unavailable' }, { status: 404 })
  if (!(await writeDashboardSetting(key, value))) return NextResponse.json({ error: 'Could not save settings' }, { status: 503 })
  revalidatePath('/')
  revalidatePath('/dashboard')
  return NextResponse.json({ ok: true, value })
}
