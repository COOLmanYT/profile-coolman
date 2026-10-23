function decodeXml(value) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

export function parseLatestYoutubeVideos(xml) {
  const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap((match) => {
    const entry = match[1]
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1]
    const links = [...entry.matchAll(/<link\b[^>]*>/g)].map((link) => link[0])
    const alternateLink = links.find((link) => /\brel=['"]alternate['"]/.test(link)) ?? links[0]
    const url = alternateLink?.match(/\bhref=['"]([^'"]+)/)?.[1] ?? (id ? `https://www.youtube.com/watch?v=${id}` : undefined)
    const rawViews = entry.match(/<media:statistics\b[^>]*\bviews=['"](\d+)['"]/)?.[1]
    const views = rawViews === undefined ? undefined : Number(rawViews)
    return id && title && url ? [{ id, title: decodeXml(title), url: decodeXml(url), publishedAt, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, isShort: url.includes('/shorts/'), ...(Number.isSafeInteger(views) ? { views } : {}) }] : []
  })
  videos.sort((a, b) => (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0))
  return { latest: videos[0], short: videos.find((video) => video.isShort), longform: videos.find((video) => !video.isShort) }
}

// Read complete JSON objects rather than matching unrelated numbers elsewhere on a page.
export function parseYoutubePageData(page, variable) {
  const marker = new RegExp(`(?:var\\s+${variable}|\\b${variable}|window\\[['"]${variable}['"]\\])\\s*=\\s*`).exec(page)
  if (!marker) return null
  const start = page.indexOf('{', marker.index + marker[0].length)
  let depth = 0, quoted = false, escaped = false
  for (let i = start; start >= 0 && i < page.length; i++) {
    const char = page[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) {
      try { return JSON.parse(page.slice(start, i + 1)) } catch { return null }
    }
  }
  return null
}

function textOf(value) {
  return typeof value === 'string' ? value : value?.simpleText ?? value?.content ?? value?.runs?.map((run) => run.text).join('')
}

export function parseYoutubeChannel(page) {
  const data = parseYoutubePageData(page, 'ytInitialData')
  const channel = {}
  function visit(value) {
    if (!value || typeof value !== 'object') return
    const about = value.aboutChannelViewModel
    if (about) {
      channel.subscribers = textOf(about.subscriberCountText)
      channel.totalViews = textOf(about.viewCountText)
      channel.videoCount = textOf(about.videoCountText)
    }
    const header = value.c4TabbedHeaderRenderer
    if (header && !channel.subscribers) channel.subscribers = textOf(header.subscriberCountText)
    if (value.channelMetadataRenderer?.title) {
      channel.title = value.channelMetadataRenderer.title
      const avatar = value.channelMetadataRenderer.avatar?.thumbnails?.[0]?.url
      if (avatar) channel.avatarUrl = avatar
    }
    // The modern channel header stores its public counts as text runs.
    if (value.text?.content && / subscribers$/.test(value.text.content) && !channel.subscribers) channel.subscribers = value.text.content
    for (const child of Object.values(value)) visit(child)
  }
  visit(data)
  return channel
}

// Channel tabs provide format evidence even when Shorts use ordinary watch URLs
// in the RSS feed. They also reach beyond the feed's recent-upload window.
export function parseYoutubeTab(page, format, channelId) {
  const data = parseYoutubePageData(page, 'ytInitialData')
  if (data?.metadata?.channelMetadataRenderer?.externalId !== channelId) return null
  let selected
  function findTab(value) {
    if (!value || typeof value !== 'object' || selected) return
    if (value.tabRenderer?.selected) {
      const tab = value.tabRenderer
      const path = tab.endpoint?.commandMetadata?.webCommandMetadata?.url?.split('?')[0]
      if (path?.endsWith(`/${format}`) || tab.title?.toLowerCase() === format || (format === 'streams' && tab.title === 'Live')) selected = tab.content
      return
    }
    for (const child of Object.values(value)) findTab(child)
  }
  findTab(data.contents)
  if (!selected) return null
  let video
  function findVideo(value) {
    if (!value || typeof value !== 'object' || video) return
    const renderer = format === 'shorts' ? value.reelItemRenderer : value.videoRenderer
    const lockup = format === 'shorts' ? value.shortsLockupViewModel : undefined
    const regular = format !== 'shorts' && value.lockupViewModel?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' ? value.lockupViewModel : undefined
    const id = renderer?.videoId ?? lockup?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ?? regular?.contentId
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      video = { id, title: textOf(renderer?.title) ?? textOf(renderer?.headline) ?? lockup?.overlayMetadata?.primaryText?.content ?? regular?.metadata?.lockupMetadataViewModel?.title?.content ?? 'YouTube upload', url: `https://www.youtube.com/${format === 'shorts' ? 'shorts/' : 'watch?v='}${id}`, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, isShort: format === 'shorts' }
      return
    }
    for (const child of Object.values(value)) findVideo(child)
  }
  findVideo(selected)
  return video ?? undefined
}

export function enrichYoutubeVideo(video, page) {
  if (!video) return undefined
  const player = parseYoutubePageData(page, 'ytInitialPlayerResponse')
  if (player?.videoDetails?.videoId !== video.id) return video
  const details = player.microformat?.playerMicroformatRenderer
  const views = Number(player.videoDetails.viewCount)
  return { ...video, title: player.videoDetails.title ?? video.title, publishedAt: details?.publishDate ?? details?.uploadDate ?? video.publishedAt, ...(Number.isSafeInteger(views) && views >= 0 ? { views } : {}) }
}

export function parseYoutubeLive(page, channelId) {
  const player = parseYoutubePageData(page, 'ytInitialPlayerResponse')
  // /live redirects to the channel page when no current broadcast exists.
  // Only accept that response if it identifies the expected channel.
  if (!player) {
    const data = parseYoutubePageData(page, 'ytInitialData')
    if (data?.metadata?.channelMetadataRenderer?.externalId === channelId) return { status: 'offline' }
  }
  if (player?.videoDetails?.channelId !== channelId) return { status: 'unknown' }
  const live = player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails
  if (live?.isLiveNow === true) return { status: 'live', url: `https://www.youtube.com/watch?v=${player.videoDetails.videoId}`, title: player.videoDetails.title }
  // An ended or scheduled broadcast is not evidence that the channel is offline.
  return { status: 'unknown' }
}

export function parseYoutubeViewCount(page) {
  const rawCount = page.match(/\"interactionCount\"\s*:\s*\"?(\d[\d,]*)\"?/)?.[1]
    ?? page.match(/\"viewCount\"\s*:\s*\"?(\d[\d,]*)\"?/)?.[1]
  if (!rawCount) return undefined
  const count = Number(rawCount.replace(/,/g, ''))
  return Number.isSafeInteger(count) ? count : undefined
}
