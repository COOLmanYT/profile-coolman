function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
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
    return id && title && url ? [{ id, title: decodeXml(title), url: decodeXml(url), publishedAt, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, isShort: url.includes('/shorts/') }] : []
  })
  return { short: videos.find((video) => video.isShort), longform: videos.find((video) => !video.isShort) }
}

export function parseYoutubeViewCount(page) {
  const rawCount = page.match(/\"interactionCount\"\s*:\s*\"?(\d[\d,]*)\"?/)?.[1]
    ?? page.match(/\"viewCount\"\s*:\s*\"?(\d[\d,]*)\"?/)?.[1]
  if (!rawCount) return undefined
  const count = Number(rawCount.replace(/,/g, ''))
  return Number.isSafeInteger(count) ? count : undefined
}
