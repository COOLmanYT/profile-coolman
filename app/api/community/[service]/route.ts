import { NextRequest, NextResponse } from 'next/server'
import { fetchCommunityProfile } from '@/lib/community-profiles.mjs'
import { createTtlCache } from '@/lib/ttl-cache.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'

const caches = {
  roblox: createTtlCache({ ttlMs: 60_000, staleOnError: false }),
  steam: createTtlCache({ ttlMs: 60_000, staleOnError: false }),
}

export async function GET(req: NextRequest, context: { params: Promise<{ service: string }> }) {
  const { service } = await context.params
  if (service !== 'roblox' && service !== 'steam') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const rate = limitPublicRequest(req, `community-${service}`)
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } })
  try {
    const data = await caches[service].get(async () => ({ ...await fetchCommunityProfile(service), updatedAt: new Date().toISOString() }))
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=60' } })
  } catch {
    return NextResponse.json({ error: 'PROFILE_UNAVAILABLE', providerStatus: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
