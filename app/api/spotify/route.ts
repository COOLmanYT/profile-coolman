import { NextRequest, NextResponse } from 'next/server'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'
import { createTtlCache } from '@/lib/ttl-cache.mjs'
import { createSpotifyFetcher, SpotifyCooldownError } from '@/lib/spotify-fetch.mjs'

// Fetch at request time; successful public playback has a short CDN-only TTL.
export const dynamic = 'force-dynamic'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing'
const SPOTIFY_PLAYBACK_URL = 'https://api.spotify.com/v1/me/player'
const SPOTIFY_PLAYLIST_URL = 'https://api.spotify.com/v1/playlists'
const SPOTIFY_RECENTLY_PLAYED_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=5'

// Set SPOTIFY_DEBUG=true in your environment to include upstream status codes and
// playback diagnostics in API responses. Never enable this in production long-term.
const DEBUG = process.env.SPOTIFY_DEBUG === 'true'
const spotifyFetch = createSpotifyFetcher(monitoredFetch)
const playbackCache = createTtlCache({ ttlMs: 15_000, staleOnError: false })
const noStore = { headers: { 'Cache-Control': 'no-store' } }

// Spotify access tokens last 60 minutes. Cache the refreshed token for slightly
// less so concurrent profile polls share one refresh instead of each request
// exchanging a new token.
const SPOTIFY_TOKEN_CACHE_TTL_MS = 50 * 60 * 1000
const spotifyTokenCache = createTtlCache({ ttlMs: SPOTIFY_TOKEN_CACHE_TTL_MS, staleOnError: false })

// Playlist public/private state changes rarely and only gates the "Open
// Playlist" link. Cache it per playlist id for a few minutes to avoid an extra
// round-trip on every playback poll.
const PLAYLIST_VISIBILITY_TTL_MS = 5 * 60 * 1000
const playlistVisibilityCaches = new Map<string, ReturnType<typeof createTtlCache>>()

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
  // The cache only stores resolved values, so throw on failure to avoid
  // caching a transient refresh error for the full token TTL. Successful
  // tokens are shared across concurrent requests.
  try {
    const accessToken = await spotifyTokenCache.get(async () => {
      const clientId = process.env.SPOTIFY_CLIENT_ID
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
      const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN

      if (!clientId || clientId === 'placeholder') {
        throw new Error('missing_SPOTIFY_CLIENT_ID')
      }
      if (!clientSecret || clientSecret === 'placeholder') {
        throw new Error('missing_SPOTIFY_CLIENT_SECRET')
      }
      if (!refreshToken || refreshToken === 'placeholder') {
        throw new Error('missing_SPOTIFY_REFRESH_TOKEN')
      }

      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const res = await spotifyFetch(SPOTIFY_TOKEN_URL, {
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
        throw new Error(`token_refresh_failed:${res.status}:${text.slice(0, 200)}`)
      }

      const data = await res.json()
      if (!data.access_token) {
        throw new Error('no_access_token_in_response')
      }
      // Spotify may return a new refresh token (token rotation). We cannot persist it
      // server-side without storage, so the existing token remains in effect for this
      // request. If you see auth errors over time, re-generate and update
      // SPOTIFY_REFRESH_TOKEN in your deployment environment.
      return data.access_token as string
    })
    return { accessToken }
  } catch (error) {
    if (error instanceof SpotifyCooldownError) throw error
    return { error: error instanceof Error ? error.message : 'token_refresh_failed' }
  }
}

async function fetchPlaylistVisibility(accessToken: string, playlistId: string): Promise<boolean> {
  let cache = playlistVisibilityCaches.get(playlistId)
  if (!cache) {
    cache = createTtlCache({ ttlMs: PLAYLIST_VISIBILITY_TTL_MS })
    playlistVisibilityCaches.set(playlistId, cache)
  }
  return cache.get(async () => {
    try {
      const res = await spotifyFetch(
        `${SPOTIFY_PLAYLIST_URL}/${playlistId}?fields=public`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        }
      )
      if (!res.ok) return false
      const playlistJson: unknown = await res.json().catch(() => null)
      if (!playlistJson || typeof playlistJson !== 'object') return false
      const playlistPublic = (playlistJson as { public?: unknown }).public
      return playlistPublic === true
    } catch {
      return false
    }
  })
}

async function getPlaylistVisibility(accessToken: string, playlistId?: string): Promise<boolean> {
  if (!playlistId) return false
  return fetchPlaylistVisibility(accessToken, playlistId)
}

async function mapTrackData(data: SpotifyPlaybackResponse, accessToken: string) {
  const item = data.item
  if (!item) return null
  const artists = (item.artists ?? []).map((a) => a.name)
  const contextUri = data.context?.uri
  const playlistId =
    data.context?.type === 'playlist' && typeof contextUri === 'string'
      ? contextUri.replace('spotify:playlist:', '')
      : undefined

  const contextIsPublic = await getPlaylistVisibility(accessToken, playlistId)

  return {
    isPlaying: !!data.is_playing,
    title: item.name,
    artist: artists.join(', '),
    artists,
    albumArt: item.album?.images?.[0]?.url,
    songUrl: item.external_urls?.spotify,
    durationMs: item.duration_ms ?? 0,
    progressMs: data.progress_ms ?? 0,
    embedUrl: item.id ? `https://open.spotify.com/embed/track/${item.id}` : undefined,
    contextType: data.context?.type,
    contextUri: contextIsPublic ? contextUri : undefined,
    contextUrl: contextIsPublic
      ? data.context?.external_urls?.spotify ?? (playlistId ? `https://open.spotify.com/playlist/${playlistId}` : undefined)
      : undefined,
    contextIsPublic,
  }
}

type SpotifyRecentlyPlayedResponse = {
  items?: Array<{
    played_at?: string
    track?: {
      name?: string
      artists?: Array<{ name?: string }>
      album?: { images?: Array<{ url?: string }> }
      external_urls?: { spotify?: string }
    }
  }>
}

async function loadSpotify(history: boolean) {
  try {
    const tokenResult = await getAccessToken()
    if (tokenResult.error || !tokenResult.accessToken) {
      return NextResponse.json({ providerStatus: 'unavailable', error: 'Spotify authentication unavailable' }, { ...noStore, status: 503 })
    }

    const accessToken = tokenResult.accessToken

    if (history) {
      const historyRes = await spotifyFetch(SPOTIFY_RECENTLY_PLAYED_URL, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
      if (!historyRes.ok) return NextResponse.json({ providerStatus: 'unavailable', error: 'Spotify history unavailable' }, { ...noStore, status: 503 })
      const historyData = await historyRes.json() as SpotifyRecentlyPlayedResponse
      if (!Array.isArray(historyData.items)) throw new Error('Invalid Spotify history')
      const items = historyData.items.flatMap((item) => item.track?.name ? [{
        title: item.track.name,
        artist: (item.track.artists ?? []).map((artist) => artist.name).filter(Boolean).join(', '),
        albumArt: item.track.album?.images?.[0]?.url,
        songUrl: item.track.external_urls?.spotify,
        playedAt: item.played_at,
      }] : [])
      return NextResponse.json({ providerStatus: 'healthy', items }, noStore)
    }

    // Primary: /v1/me/player/currently-playing
    const nowPlayingRes = await spotifyFetch(SPOTIFY_NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (nowPlayingRes.status === 200) {
      const data = (await nowPlayingRes.json()) as SpotifyPlaybackResponse
      if (data.item) {
        const track = await mapTrackData(data, accessToken)
        if (track) return NextResponse.json({ ...track, providerStatus: 'healthy' }, noStore)
      }
    }

    // Fallback: /v1/me/player (Get Playback State)
    // Covers cases where currently-playing returns 204 (e.g. certain device contexts
    // or Spotify considers the stream "not current") but playback is actually active.
    const playbackRes = await spotifyFetch(SPOTIFY_PLAYBACK_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (playbackRes.status === 200) {
      const data = (await playbackRes.json()) as SpotifyPlaybackResponse
      if (data.item) {
        const track = await mapTrackData(data, accessToken)
        if (track) return NextResponse.json({ ...track, providerStatus: nowPlayingRes.ok ? 'healthy' : 'degraded' }, noStore)
      }
      return NextResponse.json({
        providerStatus: nowPlayingRes.ok ? 'healthy' : 'degraded',
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

    if (nowPlayingRes.ok && playbackRes.ok) {
      return NextResponse.json({ providerStatus: 'healthy', isPlaying: false }, noStore)
    }
    return NextResponse.json({ providerStatus: 'unavailable', error: 'Spotify playback unavailable' }, { ...noStore, status: 503 })
  } catch (error) {
    if (error instanceof SpotifyCooldownError) {
      return NextResponse.json({ providerStatus: 'unavailable', error: 'Spotify cooling down' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(error.retryAfterSeconds) } })
    }
    return NextResponse.json({ providerStatus: 'unavailable', error: 'Spotify playback unavailable' }, { ...noStore, status: 503 })
  }
}

// Only public playback is cached. History and errors always stay out of the CDN.
export async function GET(req: NextRequest) {
  const rate = limitPublicRequest(req, 'spotify')
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(rate.retryAfterSeconds) } })
  if (req.nextUrl.searchParams.get('history') === '1') return loadSpotify(true)
  try {
    const body = await playbackCache.get(async () => {
      const response = await loadSpotify(false)
      if (!response.ok) throw response
      return { ...await response.json(), observedAt: Date.now() }
    })
    return NextResponse.json(body, { headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Vercel-CDN-Cache-Control': 'max-age=15',
    } })
  } catch (error) {
    if (error instanceof Response) return error.clone()
    return NextResponse.json({ providerStatus: 'unavailable', error: 'Spotify playback unavailable' }, { ...noStore, status: 503 })
  }
}
