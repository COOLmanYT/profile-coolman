import { dashboardAccess } from '@/lib/dashboard-access'
import { isModuleAvailable } from '@/lib/site-config.mjs'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { exchangeAuthorizationCode, getTwitchRedirectUri } from '@/lib/twitch'

const STATE_COOKIE = 'twitch_oauth_state'

export async function GET(req: NextRequest) {
  if (!isModuleAvailable('twitch')) return NextResponse.json({ error: 'MODULE_DISABLED' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const session = await getServerSession(authOptions)
  const access = await dashboardAccess(session)
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const expectedState = req.cookies.get(STATE_COOKIE)?.value
  if (!access?.owner || !code || !state || state !== expectedState) {
    return NextResponse.json({ error: 'Invalid Twitch authorization request' }, { status: 400 })
  }

  const redirectUri = getTwitchRedirectUri(req.url)
  const token = await exchangeAuthorizationCode(code, redirectUri)
  if (!token) return NextResponse.json({ error: 'Unable to save Twitch authorization' }, { status: 500 })

  const response = NextResponse.redirect(new URL('/dashboard?twitch=connected', req.url))
  response.cookies.delete(STATE_COOKIE)
  return response
}
