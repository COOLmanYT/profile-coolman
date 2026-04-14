import { NextResponse } from 'next/server'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing'

async function getAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken ||
      clientId === 'placeholder' || clientSecret === 'placeholder' || refreshToken === 'placeholder') {
    return null
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
  if (!res.ok) return null
  const data = await res.json()
  return data.access_token as string
}

export async function GET() {
  try {
    const accessToken = await getAccessToken()
      if (!accessToken) {
      return NextResponse.json({
        isPlaying: false,
        debug: { stage: 'no_access_token' },
    })
  }

    const res = await fetch(SPOTIFY_NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (res.status === 204 || res.status > 400) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({
        isPlaying: false,
        debug: {
          currentlyPlayingStatus: res.status,
          currentlyPlayingBody: text.slice(0, 500),
        },
      })
    }

    const data = await res.json()

    if (!data.is_playing || data.item === null) {
      return NextResponse.json({ isPlaying: false })
    }

    return NextResponse.json({
      isPlaying: data.is_playing,
      title: data.item.name,
      artist: data.item.artists?.map((a: { name: string }) => a.name).join(', '),
      albumArt: data.item.album?.images?.[0]?.url,
      songUrl: data.item.external_urls?.spotify,
    })
  } catch {
    return NextResponse.json({ isPlaying: false })
  }
}
