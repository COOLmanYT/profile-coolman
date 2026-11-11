import { isTrackerDestination } from './privacy-policy.mjs'

export const embedOrigins = {
  spotify: 'https://open.spotify.com',
  youtube: 'https://www.youtube-nocookie.com',
}

/** @param {keyof typeof embedOrigins} provider @param {string | undefined} value */
export function approvedEmbedUrl(provider, value) {
  if (!value || isTrackerDestination(value)) return undefined
  try {
    const url = new URL(value)
    if (url.origin === embedOrigins[provider] && !url.username && !url.password && url.pathname.startsWith('/embed/')) return url.href
  } catch { /* Treat malformed provider data as unavailable. */ }
  return undefined
}
