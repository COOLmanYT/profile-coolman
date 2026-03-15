import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_DISCORD_ID = process.env.DISCORD_USER_ID

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as { id?: string })?.id
  if (!userId || !ALLOWED_DISCORD_ID || userId !== ALLOWED_DISCORD_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, value } = await req.json()
  if (typeof id !== 'string' || typeof value !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) {
    return NextResponse.json({ ok: true })
  }

  try {
    const supabase = createClient(url, key)
    await supabase
      .from('toggles')
      .upsert({ id, value, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
