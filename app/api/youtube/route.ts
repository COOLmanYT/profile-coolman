import { NextRequest, NextResponse } from 'next/server'
import { parseLatestYoutubeVideos, parseYoutubeChannel, parseYoutubeLive, parseYoutubeViewCount } from '@/lib/youtube-feed.mjs'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'

const CHANNEL_ID = 'UCJr64JsgfMr8SHeUhLA3lKw'
const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`

async function page(url: string, revalidate = 900) {
  try {
    const response = await monitoredFetch('youtube', url, { headers: { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': 'Mozilla/5.0' }, next: { revalidate } })
    return response.ok ? await response.text() : null
  } catch { return null }
}

async function channelStats() {
  // Optional official API source; the key is used only on the server.
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const response = await monitoredFetch('youtube', `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${CHANNEL_ID}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`, { next: { revalidate: 900 } })
      if (response.ok) {
        const item = (await response.json()).items?.[0]
        if (item?.statistics) {
          const count = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value).toLocaleString('en-US') : undefined
          return { title: item.snippet?.title, subscribers: item.statistics.hiddenSubscriberCount ? undefined : count(item.statistics.subscriberCount), totalViews: count(item.statistics.viewCount), videoCount: count(item.statistics.videoCount) }
        }
      }
    } catch { /* Public page fallback remains available. */ }
  }
  const html = await page(`${CHANNEL_URL}/about?hl=en`)
  return html ? parseYoutubeChannel(html) : {}
}

export async function GET(req: NextRequest) {
  const rate = limitPublicRequest(req, 'youtube')
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  const [xml, channel, livePage] = await Promise.all([
    page(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`),
    channelStats(),
    page(`${CHANNEL_URL}/live?hl=en`, 60),
  ])
  const videos = parseLatestYoutubeVideos(xml ?? '')
  let latest = videos.latest
  if (latest && latest.views === undefined) {
    const html = await page(`https://www.youtube.com/watch?v=${latest.id}`)
    if (html) latest = { ...latest, views: parseYoutubeViewCount(html) }
  }
  return NextResponse.json({
    latest,
    channel: { ...channel, url: CHANNEL_URL },
    live: livePage ? parseYoutubeLive(livePage, CHANNEL_ID) : { status: 'unknown' },
    uploadsUnavailable: !xml || !/<feed\b/.test(xml),
    updatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } })
}
