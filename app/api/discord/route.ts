import { NextRequest, NextResponse } from 'next/server'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'

const DISCORD_USER_ID = process.env.DISCORD_USER_ID
const noStore = { headers: { 'Cache-Control': 'no-store' } }

export async function GET(req: NextRequest) {
  const rate = limitPublicRequest(req, 'discord')
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  if (!DISCORD_USER_ID || DISCORD_USER_ID === 'placeholder') {
    return NextResponse.json({ providerStatus: 'unavailable', error: 'Discord presence unavailable' }, { ...noStore, status: 503 })
  }
  try {
    const res = await monitoredFetch('discord',
      `https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`,
      { cache: 'no-store' }
    )
    if (!res.ok) {
      return NextResponse.json({ providerStatus: 'unavailable', error: 'Discord presence unavailable' }, { ...noStore, status: 503 })
    }
    const json = await res.json()
    if (!json.success || !['online', 'idle', 'dnd', 'offline'].includes(json.data?.discord_status)) {
      return NextResponse.json({ providerStatus: 'unavailable', error: 'Discord presence unavailable' }, { ...noStore, status: 503 })
    }
    const data = json.data
    return NextResponse.json({
      providerStatus: 'healthy',
      discord_status: data.discord_status,
      activities: data.activities ?? [],
      discord_user: data.discord_user,
      kv: data.kv ?? {},
      active_on_discord_mobile: data.active_on_discord_mobile ?? false,
      active_on_discord_web: data.active_on_discord_web ?? false,
      active_on_discord_desktop: data.active_on_discord_desktop ?? false,
    }, noStore)
  } catch {
    return NextResponse.json({ providerStatus: 'unavailable', error: 'Discord presence unavailable' }, { ...noStore, status: 503 })
  }
}
