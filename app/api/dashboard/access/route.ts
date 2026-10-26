import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { dashboardAccess, validMembers } from '@/lib/dashboard-access'
import { siteConfig } from '@/lib/site-config.mjs'
import { writeDashboardSetting } from '@/lib/dashboard-settings'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  if (!siteConfig.dashboard.features.accessManagement) return NextResponse.json({ error: 'Access management is disabled' }, { status: 404 })
  const access = await dashboardAccess(await getServerSession(authOptions))
  if (!access?.owner) return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  let value
  try { value = await req.json() } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }) }
  if (!validMembers(value)) return NextResponse.json({ error: 'Use unique provider account IDs, with at most 50 members' }, { status: 400 })
  if (!(await writeDashboardSetting('dashboard-access', value.map(({ provider, subject }) => ({ provider, subject }))))) return NextResponse.json({ error: 'Could not save access' }, { status: 503 })
  revalidatePath('/dashboard')
  return NextResponse.json({ ok: true })
}
