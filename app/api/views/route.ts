import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VIEW_COOKIE_NAME = 'profile_view_counted'
const VIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 24h

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function GET() {
  try {
    const supabase = getSupabase()
    if (!supabase) return NextResponse.json({ count: 0 })
    const { data } = await supabase
      .from('views')
      .select('count')
      .eq('id', 'profile')
      .single()
    return NextResponse.json({ count: data?.count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    if (!supabase) return NextResponse.json({ count: 0 })

    const { data: existing } = await supabase
      .from('views')
      .select('count')
      .eq('id', 'profile')
      .single()

    if (req.cookies.get(VIEW_COOKIE_NAME)?.value === '1') {
      return NextResponse.json({ count: existing?.count ?? 0 })
    }

    const newCount = (existing?.count ?? 0) + 1

    await supabase
      .from('views')
      .upsert({ id: 'profile', count: newCount })

    const res = NextResponse.json({ count: newCount })
    res.cookies.set(VIEW_COOKIE_NAME, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: VIEW_COOKIE_MAX_AGE_SECONDS,
    })
    return res
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
