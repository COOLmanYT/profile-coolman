export const COLLECTION_KEYS = ['country', 'time', 'referrer', 'outbound', 'device', 'os', 'browser']
export const DIMENSION_KEYS = ['country', 'hour', 'referrer', 'outbound', 'device', 'os', 'browser']
const PUBLIC_PATHS = ['/', '/options', '/status', '/privacy', '/terms', '/licence', '/backgrounds', '/changelog']
const PROVIDER_HOSTS = ['youtube.com', 'youtu.be', 'twitch.tv', 'open.spotify.com', 'spotify.com', 'github.com', 'roblox.com', 'steamcommunity.com', 'store.steampowered.com', 'buymeacoffee.com', 'discord.gg', 'discord.com', 'x.com']
const host = value => value.toLowerCase().replace(/^www\./, '')
const publicDomain = value => value.length <= 253 && /^[a-z0-9][a-z0-9.-]*$/.test(value) && value.includes('.') && !/^[\d.]+$/.test(value)

export function respectsPrivacySignals(headers, config) {
  return config.analytics.respectPrivacySignals && (headers.get('dnt') === '1' || headers.get('sec-gpc') === '1')
}

export function referrerDomain(value, origin) {
  if (!value) return 'Direct / Unknown'
  try {
    if (typeof value !== 'string' || value.length > 2048) return 'Direct / Unknown'
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return 'Direct / Unknown'
    if (url.origin === origin) return 'Internal'
    const domain = host(url.hostname)
    return publicDomain(domain) ? domain : 'Direct / Unknown'
  } catch { return 'Direct / Unknown' }
}

export function destinationKey(value, config) {
  try {
    const url = new URL(value, config.site.url)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    if (url.origin === new URL(config.site.url).origin) return PUBLIC_PATHS.includes(url.pathname) ? url.pathname : null
    const domain = host(url.hostname)
    if (!publicDomain(domain)) return 'Other external'
    const allowed = new Set([...PROVIDER_HOSTS, ...config.socials.map(link => host(new URL(link.url).hostname)), host(new URL(config.providers.status.url).hostname)])
    return allowed.has(domain) ? domain : 'Other external'
  } catch { return null }
}

export function validDestinationKey(value, config) {
  return typeof value === 'string' && (value === 'Other external' || PUBLIC_PATHS.includes(value) || destinationKey(`https://${value}`, config) === value)
}

export function viewDimensions({ policy, country, agent, referrer, origin, now = new Date() }) {
  const result = {}
  if (policy.country) result.country = typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : 'Unknown'
  if (policy.time) result.hour = String(now.getUTCHours()).padStart(2, '0')
  if (policy.referrer) result.referrer = referrerDomain(referrer, origin)
  const device = agent.device?.type
  if (policy.device) result.device = ({ mobile: 'Mobile', tablet: 'Tablet', console: 'Console', smarttv: 'TV', wearable: 'Wearable', embedded: 'Other' })[device] ?? (agent.browser?.name ? 'Desktop' : 'Unknown')
  if (policy.os) result.os = ['Windows', 'Mac OS', 'iOS', 'Android', 'Linux', 'Ubuntu', 'Chrome OS'].includes(agent.os?.name) ? agent.os.name : 'Other / Unknown'
  if (policy.browser) result.browser = ['Chrome', 'Chrome Mobile', 'Edge', 'Firefox', 'Firefox Mobile', 'Safari', 'Mobile Safari', 'Samsung Internet', 'Opera', 'Opera Mobile', 'IE'].includes(agent.browser?.name) ? agent.browser.name : 'Other / Unknown'
  return result
}
