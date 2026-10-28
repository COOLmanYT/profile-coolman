import { NextRequest, NextResponse } from 'next/server'
import { siteConfig } from '@/lib/site-config.mjs'
import { getSupabase } from '@/lib/supabase-server'
import { getCollectionPolicy, readSmallJson } from '@/lib/statistics-collection'
import { respectsPrivacySignals, validDestinationKey } from '@/lib/statistics-dimensions.mjs'
import { sameOriginLikeRequest } from '@/lib/profile-likes.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'

const headers = { 'Cache-Control': 'no-store' }
export async function POST(request: NextRequest) {
  if (!siteConfig.analytics.enabled || !siteConfig.analytics.collect.outbound || respectsPrivacySignals(request.headers, siteConfig)) return new NextResponse(null, { status: 204, headers })
  if (!sameOriginLikeRequest(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers })
  const rate = limitPublicRequest(request, 'profile-clicks', 60)
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { ...headers, 'Retry-After': String(rate.retryAfterSeconds) } })
  if (!(await getCollectionPolicy()).outbound) return new NextResponse(null, { status: 204, headers })
  let body
  try { body = await readSmallJson(request) } catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400, headers }) }
  if (!validDestinationKey(body.destination, siteConfig)) return NextResponse.json({ error: 'INVALID_DESTINATION' }, { status: 400, headers })
  try {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Unavailable')
    const { error } = await supabase.rpc('record_profile_statistics_dimensions', { p_dimensions: { outbound: body.destination } })
    if (error) throw new Error('Unavailable')
    return new NextResponse(null, { status: 204, headers })
  } catch { return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503, headers }) }
}
