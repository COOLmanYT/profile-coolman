export const PRIVACY_BLOCKED_PATH = '/privacy-blocked'
export const PRIVACY_BUILD_CODE = 'USER-PRIVACY-ERR-BUILD'
export const PRIVACY_RUNTIME_CODE = 'USER-PRIVACY-ERR-RUNTIME'

export const trackerHosts = [
  'google-analytics.com', 'analytics.google.com', 'googletagmanager.com',
  'googlesyndication.com', 'doubleclick.net', 'googleadservices.com', 'adservice.google.com',
  'connect.facebook.net', 'bat.bing.com', 'clarity.ms', 'hotjar.com', 'hotjar.io',
  'mixpanel.com', 'amplitude.com', 'posthog.com', 'segment.io', 'segment.com',
  'plausible.io', 'cdn.usefathom.com', 'static.cloudflareinsights.com',
  'vercel-scripts.com', 'vercel-insights.com', 'adnxs.com', 'criteo.com', 'scorecardresearch.com',
]

export const trackerPaths = /^\/(?:_vercel\/(?:insights|speed-insights)|cdn-cgi\/rum)(?:\/|$)/i

export function isTrackerDestination(value) {
  try {
    const url = new URL(value, 'https://privacy.invalid')
    const hostname = url.hostname.replace(/\.$/, '')
    return trackerPaths.test(url.pathname) || trackerHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

export function assertPrivacyDestination(input) {
  const url = input instanceof Request ? input.url : input
  if (isTrackerDestination(url)) throw new Error(`${PRIVACY_RUNTIME_CODE}: blocked an advertising or tracking destination`)
}

export function privacyEnvironmentViolation(env) {
  const analyticsVariable = /^(?:GOOGLE_ANALYTICS|GOOGLE_TAG_MANAGER|GA4?|GTM)_(?:ID|MEASUREMENT_ID|TRACKING_ID|CONTAINER_ID|API_SECRET)$/
  const advertisingVariable = /^(?:(?:GOOGLE_)?ADSENSE(?:_(?:ID|CLIENT|CLIENT_ID|PUBLISHER_ID|SLOT))?|GOOGLE_ADS_(?:ID|CLIENT_ID|CONVERSION_ID))$/
  for (const [key, value] of Object.entries(env)) {
    if (!value?.trim()) continue
    const name = key.replace(/^NEXT_PUBLIC_/, '')
    if ((analyticsVariable.test(name) || advertisingVariable.test(name)) && !/^(?:false|off|0)$/i.test(value.trim())) {
      return `${key} configures advertising or third-party tracking`
    }

    if ((key.startsWith('NEXT_PUBLIC_') || key === 'PROVIDER_ALERT_WEBHOOK_URL') && isTrackerDestination(value)) {
      return `${key} points to an advertising or tracking destination`
    }
  }
  return undefined
}
