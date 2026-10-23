export const LIKE_COOKIE = 'profile_like_browser'
export const LIKE_MAX_AGE = 60 * 60 * 24 * 400
export function validBrowserId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
export function sameOriginLikeRequest(request) {
  const origin = request.headers.get('origin')
  return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site'
}
