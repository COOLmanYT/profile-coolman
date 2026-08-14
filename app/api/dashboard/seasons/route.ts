import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normaliseSeasonalSettings } from '@/lib/seasonal'
import { saveSeasonalSettings } from '@/lib/site-settings'

const ALLOWED_DISCORD_ID = process.env.DISCORD_USER_ID

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId || !ALLOWED_DISCORD_ID || userId !== ALLOWED_DISCORD_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = normaliseSeasonalSettings(await req.json())
    if (!(await saveSeasonalSettings(settings))) return NextResponse.json({ error: 'Unable to save settings' }, { status: 500 })
    return NextResponse.json({ ok: true, settings })
  } catch {
    return NextResponse.json({ error: 'Invalid seasonal settings' }, { status: 400 })
  }
}
