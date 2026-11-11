import { PRIVACY_RUNTIME_CODE } from './privacy-policy.mjs'

export const privacyFailureCsp = "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

export const privacyResponseHeaders = {
  'Cache-Control': 'no-store',
  'X-Privacy-Error': PRIVACY_RUNTIME_CODE,
}

export function privacyUnavailable() {
  return Response.json({ error: PRIVACY_RUNTIME_CODE }, { status: 503, headers: privacyResponseHeaders })
}
