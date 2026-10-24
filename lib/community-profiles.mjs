export const COMMUNITY_LINKS = Object.freeze({
  roblox: 'https://www.roblox.com/users/2873599962/profile',
  steam: 'https://steamcommunity.com/id/coolmanyt1',
  buymeacoffee: 'https://buymeacoffee.com/coolmanyt',
})

function imageUrl(value, domain) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) ? url.href : undefined
  } catch { return undefined }
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

export function parseRobloxProfile(user, avatar, counts) {
  if (user?.id !== 2873599962 || typeof user.name !== 'string' || !user.name) throw new Error('ROBLOX_PROFILE_UNAVAILABLE')
  const thumbnail = avatar?.data?.find((item) => item.targetId === user.id && item.state === 'Completed')
  const stats = ['Friends', 'Followers', 'Following'].map((label, index) => ({ label, value: count(counts[index]?.count) }))
  return {
    name: typeof user.displayName === 'string' && user.displayName ? user.displayName : user.name,
    username: `@${user.name}`,
    avatarUrl: imageUrl(thumbnail?.imageUrl, 'rbxcdn.com'),
    stats,
    providerStatus: stats.some((stat) => stat.value === null) ? 'degraded' : 'healthy',
  }
}

// Only read specific text fields: no XML entities, markup, or external resources are executed.
function xmlText(xml, tag) {
  const raw = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim()
  if (raw === undefined) return undefined
  if (raw.startsWith('<![CDATA[') && raw.endsWith(']]>')) return raw.slice(9, -3).trim()
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  return raw.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (match, entity) => {
    if (!entity.startsWith('#')) return entities[entity] ?? match
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match
  })
}

export function parseSteamProfile(xml) {
  if (!/<profile\s*>/.test(xml) || xmlText(xml, 'steamID64') !== '76561198765816074') throw new Error('STEAM_PROFILE_UNAVAILABLE')
  const name = xmlText(xml, 'steamID')
  if (!name) throw new Error('STEAM_PROFILE_UNAVAILABLE')
  const isPublic = xmlText(xml, 'privacyState') === 'public'
  const rawStatus = xmlText(xml, 'onlineState')
  const status = isPublic && ['online', 'offline', 'in-game'].includes(rawStatus) ? rawStatus : 'unknown'
  const message = xmlText(xml, 'stateMessage') ?? ''
  const game = status === 'in-game' && /^In-Game\s*<br\s*\/?>/i.test(message)
    ? message.replace(/^In-Game\s*<br\s*\/?>/i, '').replace(/<[^>]*>/g, '').trim() : undefined
  const rawHours = xmlText(xml, 'hoursPlayed2Wk')
  const hours = isPublic && /^\d+(\.\d+)?$/.test(rawHours ?? '') ? Number(rawHours) : null
  return {
    name,
    username: 'coolmanyt1',
    avatarUrl: imageUrl(xmlText(xml, 'avatarFull'), 'steamstatic.com'),
    status,
    game,
    stats: [
      { label: 'Hours · past 2 weeks', value: hours !== null && Number.isFinite(hours) ? hours : null },
      { label: 'Member since', value: isPublic ? xmlText(xml, 'memberSince') || null : null },
    ],
    providerStatus: status === 'unknown' ? 'degraded' : 'healthy',
  }
}

export async function fetchCommunityProfile(service, fetcher = fetch) {
  const options = { signal: AbortSignal.timeout(10_000), next: { revalidate: 60 }, headers: { 'Accept-Language': 'en-US,en;q=0.9' } }
  if (service === 'steam') {
    // Best-effort public feed; Steam can withhold data based on profile privacy.
    const response = await fetcher('https://steamcommunity.com/profiles/76561198765816074/?xml=1&l=english', options)
    if (!response.ok) throw new Error(`STEAM_PROFILE_HTTP_${response.status}`)
    return parseSteamProfile(await response.text())
  }
  if (service !== 'roblox') throw new Error('UNKNOWN_SERVICE')
  const urls = [
    'https://users.roblox.com/v1/users/2873599962',
    'https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=2873599962&size=150x150&format=Png&isCircular=false',
    ...['friends', 'followers', 'followings'].map((kind) => `https://friends.roblox.com/v1/users/2873599962/${kind}/count`),
  ]
  const results = await Promise.all(urls.map(async (url) => {
    try {
      const response = await fetcher(url, options)
      return response.ok ? await response.json() : null
    } catch { return null }
  }))
  return parseRobloxProfile(results[0], results[1], results.slice(2))
}
