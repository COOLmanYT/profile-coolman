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
