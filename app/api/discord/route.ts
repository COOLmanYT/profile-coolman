import { NextRequest, NextResponse } from 'next/server'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'
import { createTtlCache } from '@/lib/ttl-cache.mjs'
import { recordDiscordGameEstimate } from '@/lib/discord-activity-store'

const DISCORD_USER_ID = process.env.DISCORD_USER_ID
const noStore = { headers: { 'Cache-Control': 'no-store' } }
const presenceCache = createTtlCache({ ttlMs: 15_000, staleOnError: false })

export async function GET(req: NextRequest) {
  const rate = limitPublicRequest(req, 'discord')
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(rate.retryAfterSeconds) } })
  if (!DISCORD_USER_ID || DISCORD_USER_ID === 'placeholder') {
    return NextResponse.json({ providerStatus: 'unavailable', error: 'Discord presence unavailable' }, { ...noStore, status: 503 })
  }
  try {
    const data = await presenceCache.get(async () => {
      const res = await monitoredFetch('discord',
        `https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error('Discord presence unavailable')
      const json = await res.json()
      if (!json.success || !['online', 'idle', 'dnd', 'offline'].includes(json.data?.discord_status)) {
        throw new Error('Invalid Discord presence')
      }
      return json.data
    })
    const activities = Array.isArray(data.activities) ? data.activities.filter((activity: unknown) => {
      if (!activity || typeof activity !== 'object') return false
      const candidate = activity as Record<string, unknown>
      return typeof candidate.name === 'string' && typeof candidate.type === 'number'
        && Number.isInteger(candidate.type) && candidate.type >= 0 && candidate.type <= 5
    }) : []
    const activityEstimate = await recordDiscordGameEstimate(DISCORD_USER_ID, data.discord_status === 'offline' ? [] : activities)
    return NextResponse.json({
      providerStatus: 'healthy',
      userId: DISCORD_USER_ID,
      listening_to_spotify: data.listening_to_spotify === true,
      spotify: data.spotify ?? null,
      discord_status: data.discord_status,
      activities,
      discord_user: data.discord_user,
      kv: data.kv ?? {},
      activity_estimate: activityEstimate,
      active_on_discord_mobile: data.active_on_discord_mobile ?? false,
      active_on_discord_web: data.active_on_discord_web ?? false,
      active_on_discord_desktop: data.active_on_discord_desktop ?? false,
    }, { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=15' } })
  } catch {
    return NextResponse.json({ providerStatus: 'unavailable', error: 'Discord presence unavailable' }, { ...noStore, status: 503 })
  }
}
