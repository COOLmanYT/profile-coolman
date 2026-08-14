import { NextResponse } from 'next/server'
import { parseLatestYoutubeVideos, parseYoutubeViewCount } from '@/lib/youtube-feed.mjs'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'

const CHANNEL_ID = 'UCJr64JsgfMr8SHeUhLA3lKw'
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`

async function withViewCount<T extends { id: string }>(video: T | undefined) {
  if (!video) return undefined
  try {
    const response = await monitoredFetch('youtube', `https://www.youtube.com/watch?v=${video.id}`, { next: { revalidate: 900 } })
    if (!response.ok) return video
    const views = parseYoutubeViewCount(await response.text())
    return views === undefined ? video : { ...video, views }
  } catch {
    return video
  }
}

export async function GET() {
  try {
    const response = await monitoredFetch('youtube', FEED_URL, { next: { revalidate: 900 } })
    if (!response.ok) throw new Error('YouTube feed unavailable')
    const xml = await response.text()
    const { short, longform } = parseLatestYoutubeVideos(xml)
    if (!short && !longform) throw new Error('Latest videos missing')
    const [shortWithViews, longformWithViews] = await Promise.all([withViewCount(short), withViewCount(longform)])
    return NextResponse.json({ short: shortWithViews, longform: longformWithViews }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } })
  } catch {
    return NextResponse.json({ unavailable: true }, { headers: { 'Cache-Control': 'public, s-maxage=60' } })
  }
}
