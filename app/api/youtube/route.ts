import { NextRequest, NextResponse } from 'next/server'
import { parseLatestYoutubeVideos, parseYoutubeChannel, parseYoutubeLive, parseYoutubeTab, enrichYoutubeVideo } from '@/lib/youtube-feed.mjs'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'

const CHANNEL_ID = 'UCJr64JsgfMr8SHeUhLA3lKw'
const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`
type Video = { id: string; title: string; url: string; thumbnailUrl: string; publishedAt?: string; views?: number; isShort?: boolean }

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
          return { title: item.snippet?.title, avatarUrl: item.snippet?.thumbnails?.default?.url, subscribers: item.statistics.hiddenSubscriberCount ? undefined : count(item.statistics.subscriberCount), totalViews: count(item.statistics.viewCount), videoCount: count(item.statistics.videoCount) }
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
  const [xml, channel, livePage, shortsPage, videosPage, streamsPage] = await Promise.all([
    page(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`),
    channelStats(),
    page(`${CHANNEL_URL}/live?hl=en`, 60),
    page(`${CHANNEL_URL}/shorts?hl=en`),
    page(`${CHANNEL_URL}/videos?hl=en`),
    page(`${CHANNEL_URL}/streams?hl=en`),
  ])
  const videos = parseLatestYoutubeVideos(xml ?? '')
  const shortCandidate = shortsPage ? parseYoutubeTab(shortsPage, 'shorts', CHANNEL_ID) : null
  const videoCandidate = videosPage ? parseYoutubeTab(videosPage, 'videos', CHANNEL_ID) : null
  const streamCandidate = streamsPage ? parseYoutubeTab(streamsPage, 'streams', CHANNEL_ID) : null
  const metadata = new Map<string, Promise<string | null>>()
  const enrich = (candidate: Video | undefined | null): Promise<Video | undefined> => {
    if (!candidate) return Promise.resolve(undefined)
    const known = [videos.latest, videos.short, videos.longform].find((video) => video?.id === candidate.id)
    const video = { ...known, ...candidate, publishedAt: known?.publishedAt ?? candidate.publishedAt, views: known?.views ?? candidate.views }
    if (video.views !== undefined && video.publishedAt) return Promise.resolve(video)
    if (!metadata.has(video.id)) metadata.set(video.id, page(`https://www.youtube.com/watch?v=${video.id}`))
    return metadata.get(video.id)!.then((html) => html ? enrichYoutubeVideo(video, html) : video)
  }
  const [feedLatest, short, regular, stream] = await Promise.all([enrich(videos.latest), enrich(shortCandidate ?? videos.short), enrich(videoCandidate), enrich(streamCandidate)])
  const longform = [regular, stream].filter((video): video is Video => !!video).sort((a, b) => (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0))[0]
  // The feed can fail or lag behind a channel tab. Compare known publication
  // dates from every source instead of making the whole card depend on RSS.
  const latest = [short, regular, stream, feedLatest]
    .filter((video): video is Video => !!video && Number.isFinite(Date.parse(video.publishedAt ?? '')))
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))[0] ?? feedLatest
  const uploadsUnavailable = !latest && (!xml || !/<feed\b/.test(xml) || !!(short || longform))
  return NextResponse.json({
    latest, short, longform,
    formatsUnavailable: { shorts: shortCandidate === null && !videos.short, videos: videoCandidate === null && streamCandidate === null },
    channel: { ...channel, url: CHANNEL_URL },
    live: livePage ? parseYoutubeLive(livePage, CHANNEL_ID) : { status: 'unknown' },
    uploadsUnavailable,
    updatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': uploadsUnavailable ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=60' } })
}
