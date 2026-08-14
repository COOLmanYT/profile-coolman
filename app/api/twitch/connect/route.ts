import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getTwitchConfig } from '@/lib/twitch'

const ALLOWED_DISCORD_ID = process.env.DISCORD_USER_ID
const STATE_COOKIE = 'twitch_oauth_state'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId || userId !== ALLOWED_DISCORD_ID) return NextResponse.redirect(new URL('/auth/signin', req.url))

  const config = getTwitchConfig()
  if (!config) return NextResponse.json({ error: 'Twitch credentials are not configured' }, { status: 500 })

  const state = crypto.randomUUID()
  const redirectUri = new URL('/api/twitch/callback', req.url).toString()
  const authorizationUrl = new URL('https://id.twitch.tv/oauth2/authorize')
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'moderator:read:followers channel:read:subscriptions',
    state,
  }).toString()

  const response = NextResponse.redirect(authorizationUrl)
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return response
}
