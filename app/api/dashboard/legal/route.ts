import { dashboardAccess } from '@/lib/dashboard-access'
import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { saveLegalSettings } from '@/lib/legal-settings'


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(await dashboardAccess(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { simpleModeDefault } = await req.json()
    if (typeof simpleModeDefault !== 'boolean') return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
    if (!(await saveLegalSettings({ simpleModeDefault }))) return NextResponse.json({ error: 'Unable to save settings' }, { status: 500 })
    for (const path of ['/options', '/terms', '/privacy', '/licence']) revalidatePath(path)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
  }
}
