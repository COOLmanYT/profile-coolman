import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'

const VIEW_COOKIE_NAME = 'profile_view_counted'
const VIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 24h

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

async function getViewCount() {
  const supabase = getSupabase()
  if (!supabase) return 0
  const { data, error } = await supabase
    .from('views')
    .select('count')
    .eq('id', 'profile')
    .maybeSingle()
  return error ? 0 : data?.count ?? 0
}

export async function GET(req: NextRequest) {
  const rate = limitPublicRequest(req, 'views', 120)
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  try {
    return NextResponse.json({ count: await getViewCount() })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const rate = limitPublicRequest(req, 'views', 30)
    if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
    const supabase = getSupabase()
    if (!supabase) return NextResponse.json({ count: 0 })

    if (req.cookies.get(VIEW_COOKIE_NAME)?.value === '1') {
      return NextResponse.json({ count: await getViewCount() })
    }

    const { data: newCount, error } = await supabase.rpc('increment_profile_views')
    if (error || typeof newCount !== 'number') {
      return NextResponse.json({ count: await getViewCount() }, { status: 500 })
    }

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
