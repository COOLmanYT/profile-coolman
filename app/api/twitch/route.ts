import { NextResponse } from 'next/server'
import { getTwitchAccessToken, getTwitchConfig } from '@/lib/twitch'
import { createTtlCache } from '@/lib/ttl-cache.mjs'

export const dynamic = 'force-dynamic'

const TWITCH_API_URL = 'https://api.twitch.tv/helix'
const CACHE_SECONDS = 25
const cacheHeaders = { headers: { 'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=40` } }
const twitchPresenceCache = createTtlCache({ ttlMs: CACHE_SECONDS * 1000 })

type TwitchUser = {
  id: string
  login: string
  display_name: string
  profile_image_url?: string
  description?: string
  broadcaster_type?: string
}
type TwitchStream = {
  title: string
  game_name?: string
  viewer_count: number
  thumbnail_url?: string
  started_at: string
  tags?: string[]
}

async function twitchFetch<T>(path: string, accessToken: string, clientId: string): Promise<T | null> {
  const response = await fetch(`${TWITCH_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Client-Id': clientId },
    cache: 'no-store',
  })
  if (!response.ok) return null
  return response.json() as Promise<T>
}

export async function GET() {
  const presence = await twitchPresenceCache.get(getTwitchPresence)
  return NextResponse.json(presence, cacheHeaders)
}

async function getTwitchPresence() {
  const config = getTwitchConfig()
  const accessToken = await getTwitchAccessToken()
  const login = process.env.TWITCH_BROADCASTER_LOGIN
  if (!config || !accessToken || !login) return { isLive: false }

  try {
    const users = await twitchFetch<{ data?: TwitchUser[] }>(`/users?login=${encodeURIComponent(login)}`, accessToken, config.clientId)
    const user = users?.data?.[0]
    if (!user) return { isLive: false }

    const [streams, followers, subscriptions] = await Promise.all([
      twitchFetch<{ data?: TwitchStream[] }>(`/streams?user_id=${encodeURIComponent(user.id)}`, accessToken, config.clientId),
      twitchFetch<{ total?: number }>(`/channels/followers?broadcaster_id=${encodeURIComponent(user.id)}`, accessToken, config.clientId),
      twitchFetch<{ total?: number }>(`/subscriptions?broadcaster_id=${encodeURIComponent(user.id)}`, accessToken, config.clientId),
    ])
    const stream = streams?.data?.[0]

    return {
      isLive: Boolean(stream),
      followers: followers?.total ?? null,
      subscribers: subscriptions?.total ?? null,
      profileImageUrl: user.profile_image_url,
      channelName: user.display_name,
      channelLogin: user.login,
      description: user.description,
      broadcasterType: user.broadcaster_type,
      channelUrl: `https://www.twitch.tv/${encodeURIComponent(user.login)}`,
      ...(stream && {
        title: stream.title,
        game: stream.game_name,
        viewers: stream.viewer_count,
        thumbnailUrl: stream.thumbnail_url?.replace('{width}', '440').replace('{height}', '248'),
        startedAt: stream.started_at,
        tags: stream.tags ?? [],
      }),
    }
  } catch {
    return { isLive: false }
  }
}
