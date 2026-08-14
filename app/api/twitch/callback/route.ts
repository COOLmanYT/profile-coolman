import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { exchangeAuthorizationCode } from '@/lib/twitch'

const ALLOWED_DISCORD_ID = process.env.DISCORD_USER_ID
const STATE_COOKIE = 'twitch_oauth_state'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const expectedState = req.cookies.get(STATE_COOKIE)?.value
  if (!userId || userId !== ALLOWED_DISCORD_ID || !code || !state || state !== expectedState) {
    return NextResponse.json({ error: 'Invalid Twitch authorization request' }, { status: 400 })
  }

  const redirectUri = new URL('/api/twitch/callback', req.url).toString()
  const token = await exchangeAuthorizationCode(code, redirectUri)
  if (!token) return NextResponse.json({ error: 'Unable to save Twitch authorization' }, { status: 500 })

  const response = NextResponse.redirect(new URL('/dashboard?twitch=connected', req.url))
  response.cookies.delete(STATE_COOKIE)
  return response
}
