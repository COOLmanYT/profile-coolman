import { isModuleAvailable, isControlAvailable } from '@/lib/site-config.mjs'
import { NextRequest, NextResponse } from 'next/server'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'

export async function GET(req: NextRequest) {
  if (!isModuleAvailable('youtube') || !isControlAvailable('youtube_embed_default')) return NextResponse.json({ error: 'MODULE_DISABLED' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const rate = limitPublicRequest(req, 'youtube-embed', 60)
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return NextResponse.json({ error: 'INVALID_VIDEO' }, { status: 400 })
  try {
    const response = await monitoredFetch('youtube', `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { next: { revalidate: 900 } })
    const data = response.ok ? await response.json() : null
    // Never inject provider HTML. The client builds a fixed YouTube player URL.
    return NextResponse.json({ available: data?.type === 'video' }, { headers: { 'Cache-Control': 'public, s-maxage=900' } })
  } catch { return NextResponse.json({ available: false }, { headers: { 'Cache-Control': 'no-store' } }) }
}
