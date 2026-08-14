import { createClient } from '@supabase/supabase-js'

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const TOKEN_EXPIRY_SAFETY_MS = 60_000

type TwitchTokenRow = {
  refresh_token: string
  access_token: string
  expires_at: string
}

type TwitchConfig = {
  clientId: string
  clientSecret: string
}

export type TwitchHealth = {
  state: 'connected' | 'needs_connection' | 'needs_configuration'
  message: string
  expiresAt?: string
}

export function getTwitchRedirectUri(fallbackOrigin: string) {
  const configuredUri = process.env.TWITCH_REDIRECT_URI?.trim()
  if (configuredUri) {
    try {
      const url = new URL(configuredUri)
      if (url.protocol === 'https:' || url.hostname === 'localhost') return url.toString()
    } catch {
      // Fall back to the request origin when the configured value is invalid.
    }
  }

  return new URL('/api/twitch/callback', fallbackOrigin).toString()
}

export function getTwitchConfig(): TwitchConfig | null {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret || clientId === 'placeholder' || clientSecret === 'placeholder') return null
  return { clientId, clientSecret }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function getTwitchHealth(): Promise<TwitchHealth> {
  const missing = [
    !getTwitchConfig() && 'client credentials',
    !process.env.TWITCH_BROADCASTER_LOGIN && 'broadcaster login',
    !process.env.TWITCH_REDIRECT_URI && 'redirect URI',
  ].filter(Boolean)
  if (missing.length > 0) {
    return { state: 'needs_configuration', message: `Missing ${missing.join(', ')}` }
  }

  const supabase = getSupabase()
  if (!supabase) return { state: 'needs_configuration', message: 'Missing Supabase configuration' }
  const { data, error } = await supabase
    .from('twitch_oauth')
    .select('expires_at')
    .eq('id', 'profile')
    .maybeSingle()
  if (error) return { state: 'needs_connection', message: 'Unable to read Twitch connection' }
  if (!data?.expires_at) return { state: 'needs_connection', message: 'Twitch has not been connected yet' }

  const expired = Date.parse(data.expires_at) <= Date.now()
  return {
    state: 'connected',
    message: expired ? 'Connected — token will refresh when needed' : 'Connected and ready',
    expiresAt: data.expires_at,
  }
}

async function saveToken(token: TwitchTokenRow) {
  const supabase = getSupabase()
  if (!supabase) return false
  const { error } = await supabase
    .from('twitch_oauth')
    .upsert({ id: 'profile', ...token, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  return !error
}

async function refreshToken(refreshToken: string, config: TwitchConfig): Promise<TwitchTokenRow | null> {
  const response = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    cache: 'no-store',
  })
  if (!response.ok) return null

  const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number }
  if (!data.access_token || !data.refresh_token || !data.expires_in) return null
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
}

export async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  const config = getTwitchConfig()
  if (!config) return null
  const response = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  })
  if (!response.ok) return null

  const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number }
  if (!data.access_token || !data.refresh_token || !data.expires_in) return null
  const token: TwitchTokenRow = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
  return (await saveToken(token)) ? token : null
}

export async function getTwitchAccessToken() {
  const config = getTwitchConfig()
  const supabase = getSupabase()
  if (!config || !supabase) return null

  const { data, error } = await supabase
    .from('twitch_oauth')
    .select('refresh_token, access_token, expires_at')
    .eq('id', 'profile')
    .maybeSingle()
  if (error) return null

  const stored = data as TwitchTokenRow | null
  if (stored && Date.parse(stored.expires_at) > Date.now() + TOKEN_EXPIRY_SAFETY_MS) {
    return stored.access_token
  }

  const refreshed = await refreshToken(stored?.refresh_token ?? process.env.TWITCH_REFRESH_TOKEN ?? '', config)
  if (!refreshed || !(await saveToken(refreshed))) return null
  return refreshed.access_token
}
