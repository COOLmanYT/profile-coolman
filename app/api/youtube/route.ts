import { NextResponse } from 'next/server'

const CHANNEL_ID = 'UCJr64JsgfMr8SHeUhLA3lKw'
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`

function decodeXml(value: string) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

export async function GET() {
  try {
    const response = await fetch(FEED_URL, { next: { revalidate: 900 } })
    if (!response.ok) throw new Error('YouTube feed unavailable')
    const xml = await response.text()
    const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1]
    const id = entry?.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry?.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    const publishedAt = entry?.match(/<published>([^<]+)<\/published>/)?.[1]
    const url = entry?.match(/<link rel=['"]alternate['"] href=['"]([^'"]+)/)?.[1]
    if (!id || !title || !url) throw new Error('Latest video missing')
    return NextResponse.json({ title: decodeXml(title), url, publishedAt, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } })
  } catch {
    return NextResponse.json({ unavailable: true }, { headers: { 'Cache-Control': 'public, s-maxage=60' } })
  }
}
