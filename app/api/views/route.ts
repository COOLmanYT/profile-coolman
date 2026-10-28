import { isModuleAvailable, siteConfig } from '@/lib/site-config.mjs'
import { NextRequest, NextResponse, userAgent } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'
import { getCollectionPolicy, readSmallJson } from '@/lib/statistics-collection'
import { respectsPrivacySignals, viewDimensions } from '@/lib/statistics-dimensions.mjs'
import { sameOriginLikeRequest } from '@/lib/profile-likes.mjs'

const VIEW_COOKIE_NAME = 'profile_view_counted'
const VIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 24h

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
  if (!isModuleAvailable('views')) return NextResponse.json({ error: 'MODULE_DISABLED' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const rate = limitPublicRequest(req, 'views', 120)
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  try {
    return NextResponse.json({ count: await getViewCount() })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}

export async function POST(req: NextRequest) {
  if (!isModuleAvailable('views')) return NextResponse.json({ error: 'MODULE_DISABLED' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (!sameOriginLikeRequest(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  try {
    const rate = limitPublicRequest(req, 'views', 30)
    if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
    const supabase = getSupabase()
    if (!supabase) return NextResponse.json({ count: 0 })

    if (req.cookies.get(VIEW_COOKIE_NAME)?.value === '1') {
      return NextResponse.json({ count: await getViewCount() })
    }

    const policy = respectsPrivacySignals(req.headers, siteConfig) ? null : await getCollectionPolicy()
    const agent = policy && (policy.device || policy.os || policy.browser) ? userAgent(req) : { isBot: false }
    let dimensions = {}
    if (policy && !agent.isBot) {
      let referrer: unknown
      if (policy.referrer) {
        try { referrer = (await readSmallJson(req)).referrer } catch { /* Count the view without trusting an invalid referrer body. */ }
      }
      dimensions = viewDimensions({ policy, agent, referrer, country: process.env.VERCEL === '1' ? req.headers.get('x-vercel-ip-country') : null, origin: new URL(req.url).origin })
    }
    const hasDimensions = Object.keys(dimensions).length > 0
    const { data: newCount, error } = hasDimensions
      ? await supabase.rpc('increment_profile_views_with_dimensions', { p_dimensions: dimensions })
      : await supabase.rpc('increment_profile_views')
    if (error || typeof newCount !== 'number') {
      return NextResponse.json({ count: await getViewCount() }, { status: 500 })
    }

    const res = NextResponse.json({ count: newCount }, { headers: { 'Cache-Control': 'no-store' } })
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
