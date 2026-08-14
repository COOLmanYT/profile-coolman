import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { saveLegalSettings } from '@/lib/legal-settings'

const ALLOWED_DISCORD_ID = process.env.DISCORD_USER_ID

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId || !ALLOWED_DISCORD_ID || userId !== ALLOWED_DISCORD_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { simpleModeDefault } = await req.json()
    if (typeof simpleModeDefault !== 'boolean') return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
    if (!(await saveLegalSettings({ simpleModeDefault }))) return NextResponse.json({ error: 'Unable to save settings' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
  }
}
