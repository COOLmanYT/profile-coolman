import { NextResponse } from 'next/server'
import { getTwitchAccessToken, getTwitchConfig } from '@/lib/twitch'

export const dynamic = 'force-dynamic'

const TWITCH_API_URL = 'https://api.twitch.tv/helix'
const noStore = { headers: { 'Cache-Control': 'no-store' } }

type TwitchUser = { id: string; display_name: string; profile_image_url?: string }
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
  const config = getTwitchConfig()
  const accessToken = await getTwitchAccessToken()
  const login = process.env.TWITCH_BROADCASTER_LOGIN
  if (!config || !accessToken || !login) return NextResponse.json({ isLive: false }, noStore)

  try {
    const users = await twitchFetch<{ data?: TwitchUser[] }>(`/users?login=${encodeURIComponent(login)}`, accessToken, config.clientId)
    const user = users?.data?.[0]
    if (!user) return NextResponse.json({ isLive: false }, noStore)

    const streams = await twitchFetch<{ data?: TwitchStream[] }>(`/streams?user_id=${encodeURIComponent(user.id)}`, accessToken, config.clientId)
    const stream = streams?.data?.[0]
    if (!stream) return NextResponse.json({ isLive: false }, noStore)

    const [followers, subscriptions] = await Promise.all([
      twitchFetch<{ total?: number }>(`/channels/followers?broadcaster_id=${encodeURIComponent(user.id)}`, accessToken, config.clientId),
      twitchFetch<{ total?: number }>(`/subscriptions?broadcaster_id=${encodeURIComponent(user.id)}`, accessToken, config.clientId),
    ])

    return NextResponse.json({
      isLive: true,
      title: stream.title,
      game: stream.game_name,
      viewers: stream.viewer_count,
      followers: followers?.total ?? null,
      subscribers: subscriptions?.total ?? null,
      thumbnailUrl: stream.thumbnail_url?.replace('{width}', '440').replace('{height}', '248'),
      startedAt: stream.started_at,
      tags: stream.tags ?? [],
      channelName: user.display_name,
      channelUrl: `https://www.twitch.tv/${encodeURIComponent(login)}`,
    }, noStore)
  } catch {
    return NextResponse.json({ isLive: false }, noStore)
  }
}
