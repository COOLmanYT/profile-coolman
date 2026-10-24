import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'
import { LIKE_COOKIE, LIKE_MAX_AGE, validBrowserId, sameOriginLikeRequest } from '@/lib/profile-likes.mjs'

function browserIdentity(req: NextRequest) {
  const cookie = req.cookies.get(LIKE_COOKIE)?.value
  const stored = req.headers.get('x-profile-browser-id')
  return (validBrowserId(cookie) ? cookie! : validBrowserId(stored) ? stored! : randomUUID()).toLowerCase()
}
function reply(body: object, browserId: string) {
  const response = NextResponse.json({ ...body, browserId }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(LIKE_COOKIE, browserId, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: LIKE_MAX_AGE })
  return response
}
function unavailable() {
  return NextResponse.json({ error: 'LIKES_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}
export async function GET(req: NextRequest) {
  const rate = limitPublicRequest(req, 'likes-read', 120)
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  const supabase = getSupabase()
  if (!supabase) return unavailable()
  const browserId = browserIdentity(req)
  const hash = createHash('sha256').update(browserId).digest('hex')
  try {
    const [total, like] = await Promise.all([
      supabase.from('profile_like_totals').select('count').eq('id', 'profile').maybeSingle(),
      supabase.from('profile_likes').select('browser_hash').eq('browser_hash', hash).maybeSingle(),
    ])
    if (total.error || like.error || !total.data) return unavailable()
    return reply({ count: Number(total.data.count), liked: !!like.data }, browserId)
  } catch { return unavailable() }
}
export async function POST(req: NextRequest) {
  if (!sameOriginLikeRequest(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  const rate = limitPublicRequest(req, 'likes-write', 12)
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  // A client must first initialize its persistent identity using GET.
  if (!validBrowserId(req.cookies.get(LIKE_COOKIE)?.value) && !validBrowserId(req.headers.get('x-profile-browser-id'))) return NextResponse.json({ error: 'MISSING_BROWSER_ID' }, { status: 400 })
  const supabase = getSupabase()
  if (!supabase) return unavailable()
  const browserId = browserIdentity(req)
  const hash = createHash('sha256').update(browserId).digest('hex')
  try {
    const { data, error } = await supabase.rpc('like_profile_once', { p_browser_hash: hash })
    if (error || !data || !Number.isSafeInteger(Number(data.count))) return unavailable()
    return reply({ count: Number(data.count), liked: true, added: data.added === true }, browserId)
  } catch { return unavailable() }
}
