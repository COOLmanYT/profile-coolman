import { NextResponse, type NextRequest } from 'next/server'
import { isTrackerDestination, privacyRuntimeBlocked, PRIVACY_BLOCKED_PATH } from '@/lib/privacy-policy.mjs'
import { privacyResponseHeaders, privacyUnavailable } from '@/lib/privacy-http.mjs'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === PRIVACY_BLOCKED_PATH) return NextResponse.next()

  const trackerEndpoint = isTrackerDestination(pathname)
  if (!trackerEndpoint && !privacyRuntimeBlocked()) return NextResponse.next()

  if (trackerEndpoint || pathname.startsWith('/api/') || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return privacyUnavailable()
  }

  return NextResponse.redirect(new URL(PRIVACY_BLOCKED_PATH, request.url), { status: 307, headers: privacyResponseHeaders })
}

export const config = {
  matcher: ['/((?!_next/static/).*)'],
}
