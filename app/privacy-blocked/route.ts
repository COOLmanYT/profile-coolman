import { privacyFailureCsp, privacyResponseHeaders } from '@/lib/privacy-http.mjs'
import { PRIVACY_RUNTIME_CODE } from '@/lib/privacy-policy.mjs'

const page = `<!doctype html>
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

const headers = {
  ...privacyResponseHeaders,
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': privacyFailureCsp,
}

export function GET() {
  return new Response(page, { status: 503, headers })
}

export function HEAD() {
  return new Response(null, { status: 503, headers })
}
