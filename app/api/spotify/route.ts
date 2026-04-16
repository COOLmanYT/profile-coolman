import { NextResponse } from 'next/server'

// Force this route to always be dynamic so Next.js / Vercel never statically
// caches the response. Without this, the CDN can serve a stale snapshot to
// every visitor instead of fetching live playback state.
export const dynamic = 'force-dynamic'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing'
const SPOTIFY_PLAYBACK_URL = 'https://api.spotify.com/v1/me/player'

// Set SPOTIFY_DEBUG=true in your environment to include upstream status codes and
// limited error text in API responses. Never enable this in production long-term.
const DEBUG = process.env.SPOTIFY_DEBUG === 'true'

type TokenResult =
  | { accessToken: string; error?: never }
  | { accessToken?: never; error: string }

type SpotifyPlaybackResponse = {
  is_playing?: boolean
  progress_ms?: number
  item?: {
    id?: string
    name: string
    duration_ms?: number
    artists?: Array<{ name: string }>
    album?: { images?: Array<{ url: string }> }
    external_urls?: { spotify?: string }
  } | null
  context?: {
    type?: string
    uri?: string
    external_urls?: {
      spotify?: string
    }
  } | null
}

async function getAccessToken(): Promise<TokenResult> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN

  if (!clientId || clientId === 'placeholder') {
    return { error: 'missing_SPOTIFY_CLIENT_ID' }
  }
  if (!clientSecret || clientSecret === 'placeholder') {
    return { error: 'missing_SPOTIFY_CLIENT_SECRET' }
  }
  if (!refreshToken || refreshToken === 'placeholder') {
    return { error: 'missing_SPOTIFY_REFRESH_TOKEN' }
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { error: `token_refresh_failed:${res.status}:${text.slice(0, 200)}` }
  }

  const data = await res.json()
  if (!data.access_token) {
    return { error: 'no_access_token_in_response' }
  }
  // Spotify may return a new refresh token (token rotation). We cannot persist it
  // server-side without storage, so the existing token remains in effect for this
  // request. If you see auth errors over time, re-generate and update
  // SPOTIFY_REFRESH_TOKEN in your deployment environment.
  return { accessToken: data.access_token as string }
}

function mapTrackData(data: SpotifyPlaybackResponse) {
  const item = data.item
  if (!item) return null
  const artists = (item.artists ?? []).map((a) => a.name)
  const contextUri = data.context?.uri
  const playlistId =
    data.context?.type === 'playlist' && typeof contextUri === 'string'
      ? contextUri.replace('spotify:playlist:', '')
      : undefined

  return {
    isPlaying: !!data.is_playing,
    isPaused: !data.is_playing,
    title: item.name,
    artist: artists.join(', '),
    artists,
    albumArt: item.album?.images?.[0]?.url,
    songUrl: item.external_urls?.spotify,
    durationMs: item.duration_ms ?? 0,
    progressMs: data.progress_ms ?? 0,
    embedUrl: item.id ? `https://open.spotify.com/embed/track/${item.id}` : undefined,
    contextType: data.context?.type,
    contextUri,
    contextUrl:
      data.context?.external_urls?.spotify ??
      (playlistId ? `https://open.spotify.com/playlist/${playlistId}` : undefined),
  }
}

type LanyardActivity = {
  type: number
  name: string
  details?: string
  state?: string
  assets?: { large_image?: string }
}

export async function GET() {
  // Prevent CDN / Vercel edge caches from serving stale playback state.
  const noStore = { headers: { 'Cache-Control': 'no-store' } }

  try {
    const tokenResult = await getAccessToken()
    if (tokenResult.error) {
      return NextResponse.json({
        isPlaying: false,
        ...(DEBUG ? { debug: { stage: 'no_access_token', reason: tokenResult.error } } : {}),
      }, noStore)
    }

    const { accessToken } = tokenResult

    // Primary: /v1/me/player/currently-playing
    const nowPlayingRes = await fetch(SPOTIFY_NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (nowPlayingRes.status === 200) {
      const data = (await nowPlayingRes.json()) as SpotifyPlaybackResponse
      if (data.item) {
        const track = mapTrackData(data)
        if (track) return NextResponse.json(track, noStore)
      }
    }

    // Fallback: /v1/me/player (Get Playback State)
    // Covers cases where currently-playing returns 204 (e.g. certain device contexts
    // or Spotify considers the stream "not current") but playback is actually active.
    const playbackRes = await fetch(SPOTIFY_PLAYBACK_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (playbackRes.status === 200) {
      const data = (await playbackRes.json()) as SpotifyPlaybackResponse
      if (data.item) {
        const track = mapTrackData(data)
        if (track) return NextResponse.json(track, noStore)
      }
      return NextResponse.json({
        isPlaying: false,
        ...(DEBUG
          ? {
              debug: {
                nowPlayingStatus: nowPlayingRes.status,
                playbackStatus: playbackRes.status,
                playbackIsPlaying: data.is_playing,
                playbackHasItem: !!data.item,
              },
            }
          : {}),
      }, noStore)
    }

    // Both Spotify endpoints returned non-200 (204, 4xx, etc.).
    // Last-resort: read Spotify activity from Discord presence via Lanyard.
    const discordUserId = process.env.DISCORD_USER_ID
    if (discordUserId && discordUserId !== 'placeholder') {
      try {
        const lanyardRes = await fetch(
          `https://api.lanyard.rest/v1/users/${discordUserId}`,
          { cache: 'no-store' }
        )
        if (lanyardRes.ok) {
          const lanyardJson = await lanyardRes.json().catch(() => null)
          if (lanyardJson?.success && lanyardJson.data) {
            const activities: LanyardActivity[] = lanyardJson.data.activities ?? []
            const spotifyActivity = activities.find(
              (a) => a.type === 2 && a.name.toLowerCase().includes('spotify')
            )
            if (spotifyActivity) {
              const title = spotifyActivity.details ?? spotifyActivity.name
              const artist = spotifyActivity.state
              let albumArt: string | undefined
              const largeImage = spotifyActivity.assets?.large_image
              if (largeImage) {
                albumArt = largeImage.startsWith('spotify:')
                  ? `https://i.scdn.co/image/${largeImage.split(':')[1] ?? ''}`
                  : largeImage
              }
              const songUrl =
                title || artist
                  ? `https://open.spotify.com/search/${encodeURIComponent(`${title ?? ''} ${artist ?? ''}`.trim())}`
                  : undefined

                return NextResponse.json({
                  isPlaying: true,
                  isPaused: false,
                  title,
                  artist,
                  artists: artist ? [artist] : [],
                  albumArt,
                  songUrl,
                  durationMs: 0,
                  progressMs: 0,
                  embedUrl: undefined,
                  contextType: 'fallback',
                  contextUri: undefined,
                  contextUrl: undefined,
                  ...(DEBUG ? { debug: { fallback: 'discord_lanyard' } } : {}),
                }, noStore)
              }
          }
        }
      } catch {
        // Lanyard fallback failed; fall through to not-playing response
      }
    }

    const playbackBodyText = DEBUG ? await playbackRes.text().catch(() => '') : ''
    return NextResponse.json({
      isPlaying: false,
      ...(DEBUG
        ? {
            debug: {
              nowPlayingStatus: nowPlayingRes.status,
              playbackStatus: playbackRes.status,
              playbackBody: playbackBodyText.slice(0, 500),
            },
          }
        : {}),
    }, noStore)
  } catch (err) {
    return NextResponse.json({
      isPlaying: false,
      ...(DEBUG ? { debug: { error: String(err) } } : {}),
    }, noStore)
  }
}
