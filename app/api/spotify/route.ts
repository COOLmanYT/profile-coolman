import { NextResponse } from 'next/server'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing'
const SPOTIFY_PLAYBACK_URL = 'https://api.spotify.com/v1/me/player'

// Set SPOTIFY_DEBUG=true in your environment to include upstream status codes and
// limited error text in API responses. Never enable this in production long-term.
const DEBUG = process.env.SPOTIFY_DEBUG === 'true'

type TokenResult =
  | { accessToken: string; error?: never }
  | { accessToken?: never; error: string }

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
  // Spotify may return a new refresh token (token rotation). We cannot persist it
  // server-side without storage, so the existing token remains in effect for this
  // request. If you see auth errors over time, re-generate and update
  // SPOTIFY_REFRESH_TOKEN in your deployment environment.
  return { accessToken: data.access_token as string }
}

function mapTrackData(data: {
  is_playing: boolean
  item: {
    name: string
    artists?: Array<{ name: string }>
    album?: { images?: Array<{ url: string }> }
    external_urls?: { spotify?: string }
  } | null
}) {
  const item = data.item
  if (!item) return null
  return {
    isPlaying: true,
    title: item.name,
    artist: item.artists?.map((a) => a.name).join(', '),
    albumArt: item.album?.images?.[0]?.url,
    songUrl: item.external_urls?.spotify,
  }
}

export async function GET() {
  try {
    const tokenResult = await getAccessToken()
    if (tokenResult.error) {
      return NextResponse.json({
        isPlaying: false,
        ...(DEBUG ? { debug: { stage: 'no_access_token', reason: tokenResult.error } } : {}),
      })
    }

    const { accessToken } = tokenResult

    // Primary: /v1/me/player/currently-playing
    const nowPlayingRes = await fetch(SPOTIFY_NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (nowPlayingRes.status === 200) {
      const data = await nowPlayingRes.json()
      if (data.is_playing && data.item) {
        const track = mapTrackData(data)
        if (track) return NextResponse.json(track)
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
      const data = await playbackRes.json()
      if (data.is_playing && data.item) {
        const track = mapTrackData(data)
        if (track) return NextResponse.json(track)
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
      })
    }

    // Both endpoints returned non-200 (204, 4xx, etc.)
    const playbackText = DEBUG ? await playbackRes.text().catch(() => '') : ''
    return NextResponse.json({
      isPlaying: false,
      ...(DEBUG
        ? {
            debug: {
              nowPlayingStatus: nowPlayingRes.status,
              playbackStatus: playbackRes.status,
              playbackBody: playbackText.slice(0, 500),
            },
          }
        : {}),
    })
  } catch (e) {
    return NextResponse.json({
      isPlaying: false,
      ...(DEBUG ? { debug: { error: String(e) } } : {}),
    })
  }
}
