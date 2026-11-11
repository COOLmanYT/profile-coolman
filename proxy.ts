import { NextResponse, type NextRequest } from 'next/server'
import { isTrackerDestination, privacyEnvironmentViolation, PRIVACY_BLOCKED_PATH, PRIVACY_RUNTIME_CODE } from '@/lib/privacy-policy.mjs'

const blockedHeaders = {
  'Cache-Control': 'no-store',
  'X-Privacy-Error': PRIVACY_RUNTIME_CODE,
}

const blockedPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Website bricked</title>
</head>
<body><main>
  <h1>This website has been bricked due to poor privacy.</h1>
  <p><code>${PRIVACY_RUNTIME_CODE}</code></p>
</main></body>
</html>`

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === PRIVACY_BLOCKED_PATH) {
    return new NextResponse(blockedPage, {
      status: 503,
      headers: {
        ...blockedHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      },
    })
  }

  const configurationBlocked = process.env.PROFILE_PRIVACY_BUILD_BLOCKED === '1' || privacyEnvironmentViolation(process.env)
  const trackerEndpoint = isTrackerDestination(pathname)
  if (!configurationBlocked && !trackerEndpoint) return NextResponse.next()

  if (trackerEndpoint || pathname.startsWith('/api/') || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return NextResponse.json({ error: PRIVACY_RUNTIME_CODE }, { status: 503, headers: blockedHeaders })
  }

  return NextResponse.redirect(new URL(PRIVACY_BLOCKED_PATH, request.url), { status: 307, headers: blockedHeaders })
}

export const config = {
  matcher: ['/((?!_next/static/).*)'],
}
