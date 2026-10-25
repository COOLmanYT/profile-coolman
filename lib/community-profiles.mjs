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
  const recentGames = [...xml.matchAll(/<mostPlayedGame>([\s\S]*?)<\/mostPlayedGame>/g)]
  const current = recentGames.find((match) => xmlText(match[1], 'gameName') === game)
  const appId = current && xmlText(current[1], 'gameLink')?.match(/^https:\/\/steamcommunity\.com\/app\/(\d+)\/?$/)?.[1]
  return {
    name,
    username: 'coolmanyt1',
    avatarUrl: imageUrl(xmlText(xml, 'avatarFull'), 'steamstatic.com'),
    status,
    game,
    gameUrl: appId ? `https://store.steampowered.com/app/${appId}/` : undefined,
    stats: [
      { label: 'Hours · past 2 weeks', value: null },
      { label: 'Games in library', value: null, url: `${COMMUNITY_LINKS.steam}/games/?tab=all` },
    ],
    providerStatus: status === 'unknown' ? 'degraded' : 'healthy',
  }
}

export function parseSteamPage(html) {
  // The old XML hoursPlayed2Wk field can be zero while the profile shows real activity.
  // Accept only this account's profile page, and the exact displayed total/count.
  try {
    const identity = JSON.parse(html.match(/g_rgProfileData\s*=\s*(\{[^\r\n]*\});/)?.[1] ?? '{}')
    if (identity.steamid !== '76561198765816074') return { hours: null, games: null }
  } catch { return { hours: null, games: null } }
  const recent = html.match(/class="[^"]*\brecentgame_recentplaytime\b[^"]*">\s*<div>\s*([\d,.]+)\s+hours? past 2 weeks\s*<\/div>/)?.[1]
  const gamesLink = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .find((match) => /^https:\/\/steamcommunity\.com\/(?:id\/coolmanyt1|profiles\/76561198765816074)\/games\//.test(match[1]) && /class="count_link_label">Games<\/span>/.test(match[2]))
  const rawGames = gamesLink?.[2].match(/class="profile_count_link_total">\s*([\d,]+)\s*<\/span>/)?.[1]
  const hours = recent === undefined ? null : Number(recent.replaceAll(',', ''))
  const games = rawGames === undefined ? null : Number(rawGames.replaceAll(',', ''))
  return { hours: hours !== null && Number.isFinite(hours) && hours >= 0 ? hours : null, games: count(games) }
}

function plainText(value) {
  if (typeof value !== 'string') return undefined
  return xmlText(`<text>${value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</text>`, 'text')?.slice(0, 800)
}

export function parseCoffeeProfile(html) {
  const raw = html.match(/<script\b(?=[^>]*\bdata-page="app")(?=[^>]*\btype="application\/json")[^>]*>([\s\S]*?)<\/script>/)?.[1]
  const props = raw ? JSON.parse(raw)?.props : null
  const creator = props?.creator_data?.data
  if (creator?.slug !== 'coolmanyt' || !creator.name) throw new Error('COFFEE_PROFILE_UNAVAILABLE')
  const price = Number(creator.coffee_price)
  const currency = typeof creator.currency === 'string' && /^[A-Z]{3}$/.test(creator.currency) ? creator.currency : undefined
  return {
    name: plainText(creator.name), username: plainText(creator.work),
    avatarUrl: imageUrl(creator.dp, 'buymeacoffee.com'), coverUrl: imageUrl(creator.cover_image, 'buymeacoffee.com'),
    bio: plainText(creator.description), item: plainText(creator.tag_alternative) || 'coffee',
    price: creator.coffee_price != null && Number.isFinite(price) && price > 0 && currency ? price : null, currency,
    supporters: creator.supporter_count === true ? count(creator.public_supporter_count) : null,
    memberships: creator.membership_enabled ? (props.membership_levels?.data ?? []).slice(0, 4).flatMap((level) => {
      const monthly = Number(level.price_monthly)
      return level.title && Number.isFinite(monthly) && monthly > 0 && currency ? [{ title: plainText(level.title), price: monthly, url: `${COMMUNITY_LINKS.buymeacoffee}/membership` }] : []
    }) : [],
    providerStatus: 'healthy',
  }
}

export async function fetchCommunityProfile(service, fetcher = fetch) {
  const options = { signal: AbortSignal.timeout(10_000), next: { revalidate: 60 }, headers: { 'Accept-Language': 'en-US,en;q=0.9' } }
  if (service === 'steam') {
    // Best-effort public feed; Steam can withhold data based on profile privacy.
    const [response, page] = await Promise.all([
      fetcher('https://steamcommunity.com/profiles/76561198765816074/?xml=1&l=english', options),
      fetcher('https://steamcommunity.com/profiles/76561198765816074/?l=english', options).then(async (response) => response.ok ? parseSteamPage(await response.text()) : { hours: null, games: null }).catch(() => ({ hours: null, games: null })),
    ])
    if (!response.ok) throw new Error(`STEAM_PROFILE_HTTP_${response.status}`)
    const profile = parseSteamProfile(await response.text())
    profile.stats[0].value = page.hours
    profile.stats[1].value = page.games
    if (page.hours === null || page.games === null) profile.providerStatus = 'degraded'
    return profile
  }
  if (service === 'buymeacoffee') {
    const response = await fetcher(COMMUNITY_LINKS.buymeacoffee, { ...options, next: { revalidate: 300 } })
    if (!response.ok) throw new Error(`COFFEE_PROFILE_HTTP_${response.status}`)
    return parseCoffeeProfile(await response.text())
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
