// Discord application IDs are not Steam app IDs. Use an explicit store link
// from the presence when supplied, otherwise search by the activity's name.
export function getGameActivityLink(activity) {
  if (![0, 5].includes(activity?.type) || typeof activity.name !== 'string' || !activity.name.trim()) return null
  const candidates = [activity.details_url, activity.state_url, activity.assets?.large_url, activity.assets?.small_url, activity.url]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    try {
      const url = new URL(candidate)
      const app = url.pathname.match(/^\/app\/([1-9]\d*)(?:\/|$)/)?.[1]
      if (url.protocol === 'https:' && url.hostname === 'store.steampowered.com' && !url.port && !url.username && !url.password && app) {
        return { href: `https://store.steampowered.com/app/${app}/`, source: 'steam' }
      }
    } catch { /* Ignore malformed presence links. */ }
  }
  return { href: `https://duckduckgo.com/?q=${encodeURIComponent(`${activity.name.trim()} game`)}`, source: 'search' }
}
