import { dashboardAccess } from '@/lib/dashboard-access'
import { isControlAvailable } from '@/lib/site-config.mjs'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { DEFAULT_TOGGLES } from '@/lib/toggle-defaults.mjs'


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await dashboardAccess(session))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let payload
  try { payload = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const { id, value } = payload ?? {}
  if (typeof id !== 'string' || typeof value !== 'boolean' || (!Object.hasOwn(DEFAULT_TOGGLES, id) || !isControlAvailable(id))) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    const supabase = getSupabase()
    if (!supabase) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
    const { error } = await supabase
      .from('toggles')
      .upsert({ id, value, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) {
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
    if (id === 'analytics') revalidatePath('/', 'layout')
    else revalidatePath('/')
    if (id === 'youtube_embed_default') revalidatePath('/options')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
