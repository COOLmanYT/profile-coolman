import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLatestYoutubeVideos, parseYoutubeChannel, parseYoutubeLive, parseYoutubeViewCount, parseYoutubeTab, enrichYoutubeVideo } from '../lib/youtube-feed.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'
import * as parsers from '../lib/youtube-feed.mjs'

test('separates the newest short and long-form YouTube videos', () => {
  const feed = `<feed><entry><yt:videoId>short-id</yt:videoId><title>Short &amp; sweet</title><published>2026-01-02T00:00:00Z</published><link rel="alternate" href="https://www.youtube.com/shorts/short-id"/></entry><entry><yt:videoId>long-id</yt:videoId><title>Long video</title><published>2026-01-01T00:00:00Z</published><link rel="alternate" href="https://www.youtube.com/watch?v=long-id"/></entry></feed>`
  const videos = parseLatestYoutubeVideos(feed)
  assert.equal(videos.short?.title, 'Short & sweet')
  assert.equal(videos.longform?.url, 'https://www.youtube.com/watch?v=long-id')
  assert.equal(videos.short?.id, 'short-id')
  assert.equal(videos.latest?.id, 'short-id')
  assert.equal(parseYoutubeViewCount('<script>{\"interactionCount\":\"12,345\"}</script>'), 12345)
  assert.equal(parseYoutubeViewCount('<script>{\"viewCount\":987}</script>'), 987)
})

test('latest upload sorts all formats by publication date and preserves zero feed views', () => {
  const entry = (id, date, url) => `<entry><yt:videoId>${id}</yt:videoId><title>${id}</title><published>${date}</published><link href="${url}"/><media:statistics views="0"/></entry>`
  const videos = parseLatestYoutubeVideos(`<feed>${entry('old-short', '2026-01-01', 'https://www.youtube.com/shorts/old-short')}${entry('new-stream', '2026-01-03', 'https://www.youtube.com/watch?v=new-stream')}${entry('middle', '2026-01-02', 'https://www.youtube.com/watch?v=middle')}</feed>`)
  assert.equal(videos.latest.id, 'new-stream')
  assert.equal(videos.latest.views, 0)
  assert.equal(parseLatestYoutubeVideos('<feed/>').latest, undefined)
})

test('channel stats read structured public counts and tolerate unavailable data', () => {
  const data = { metadata: { channelMetadataRenderer: { title: 'Channel } \\" name' } }, contents: { aboutChannelViewModel: { subscriberCountText: '1.2K subscribers', viewCountText: { simpleText: '23,456 views' }, videoCountText: { runs: [{ text: '42 videos' }] } } } }
  assert.deepEqual(parseYoutubeChannel(`var ytInitialData = ${JSON.stringify(data)};</script>`), { title: 'Channel } \\" name', subscribers: '1.2K subscribers', totalViews: '23,456 views', videoCount: '42 videos' })
  assert.deepEqual(parseYoutubeChannel('Consent required'), {})
  assert.equal(parseYoutubeChannel(`window["ytInitialData"] = ${JSON.stringify(data)};`).totalViews, '23,456 views')
  assert.deepEqual(parseYoutubeChannel('ytInitialData = {bad}'), {})
})

test('live detection rejects ended, upcoming, unrelated and unavailable players', () => {
  const player = (channelId, live) => `var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: { channelId, videoId: 'stream', title: 'Live now' }, microformat: { playerMicroformatRenderer: { liveBroadcastDetails: { isLiveNow: live } } } })};`
  assert.equal(parseYoutubeLive(player('channel', true), 'channel').status, 'live')
  assert.equal(parseYoutubeLive(player('other', true), 'channel').status, 'unknown')
  assert.equal(parseYoutubeLive(player('channel', false), 'channel').status, 'unknown')
  assert.equal(parseYoutubeLive('Consent required', 'channel').status, 'unknown')
  assert.equal(parseYoutubeLive(`var ytInitialData = {"metadata":{"channelMetadataRenderer":{"externalId":"channel"}}};`, 'channel').status, 'offline')
})

test('YouTube route keeps uploads when channel stats and live data fail, and rate limits before fetching', async () => {
  const original = process.env.YOUTUBE_API_KEY
  delete process.env.YOUTUBE_API_KEY
  try {
    const calls = []
    let allowed = true
    const { GET } = loadTypescript('app/api/youtube/route.ts', {
      'next/server': nextServer,
      '@/lib/youtube-feed.mjs': parsers,
      '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed, retryAfterSeconds: 30 }) },
      '@/lib/provider-monitor.mjs': { monitoredFetch: async (_provider, url) => {
        calls.push(url)
        if (url.includes('/feeds/')) return new Response('<feed><entry><yt:videoId>latest</yt:videoId><title>New Short</title><published>2026-01-04</published><media:statistics views="17"/></entry></feed>')
        throw new Error('unavailable')
      } },
    })
    const data = await (await GET({})).json()
    assert.equal(data.latest.id, 'latest')
    assert.equal(data.latest.views, 17)
    assert.equal(data.live.status, 'unknown')
    assert.equal(data.uploadsUnavailable, false)
    assert.equal(calls.length, 6)
    allowed = false
    const limited = await GET({})
    assert.equal(limited.status, 429)
    assert.equal(limited.headers.get('Retry-After'), '30')
    assert.equal(calls.length, 6)
  } finally {
    if (original === undefined) delete process.env.YOUTUBE_API_KEY
    else process.env.YOUTUBE_API_KEY = original
  }
})

test('format selection uses the selected channel tab, supports modern lockups and rejects unrelated content', () => {
  const page = (format, content, channel = 'channel') => `var ytInitialData = ${JSON.stringify({ metadata: { channelMetadataRenderer: { externalId: channel } }, contents: { tabs: [{ tabRenderer: { title: 'Home', content: { videoRenderer: { videoId: 'wrongwrong1' } } } }, { tabRenderer: { selected: true, title: format, content } }] } })};`
  const short = { shortsLockupViewModel: { onTap: { innertubeCommand: { reelWatchEndpoint: { videoId: 'short123456' } } }, overlayMetadata: { primaryText: { content: 'A Short' } } } }
  assert.equal(parseYoutubeTab(page('shorts', short), 'shorts', 'channel').id, 'short123456')
  const video = { lockupViewModel: { contentType: 'LOCKUP_CONTENT_TYPE_VIDEO', contentId: 'video123456', metadata: { lockupMetadataViewModel: { title: { content: 'A video' } } } } }
  assert.equal(parseYoutubeTab(page('videos', video), 'videos', 'channel').title, 'A video')
  assert.equal(parseYoutubeTab(page('videos', video, 'other'), 'videos', 'channel'), null)
  assert.equal(parseYoutubeTab(page('Home', video), 'videos', 'channel'), null)
  assert.equal(parseYoutubeTab(page('videos', {}), 'videos', 'channel'), undefined)
})

test('watch metadata is accepted only for the selected video', () => {
  const video = { id: 'video123456', title: 'Original' }
  const player = (id) => `var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: { videoId: id, title: 'Actual title', viewCount: '0' }, microformat: { playerMicroformatRenderer: { publishDate: '2026-01-01' } } })};`
  assert.equal(enrichYoutubeVideo(video, player('other123456')).title, 'Original')
  assert.equal(enrichYoutubeVideo(video, player(video.id)).views, 0)
  assert.equal(enrichYoutubeVideo(video, player(video.id)).publishedAt, '2026-01-01')
})

test('a Short with a generic RSS watch URL keeps its format and Videos mode returns a separate upload', async () => {
  const tab = (format, content) => `var ytInitialData = ${JSON.stringify({ metadata: { channelMetadataRenderer: { externalId: 'UCJr64JsgfMr8SHeUhLA3lKw' } }, contents: { tabs: [{ tabRenderer: { selected: true, title: format, content } }] } })};`
  const { GET } = loadTypescript('app/api/youtube/route.ts', {
    'next/server': nextServer,
    '@/lib/youtube-feed.mjs': parsers,
    '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed: true }) },
    '@/lib/provider-monitor.mjs': { monitoredFetch: async (_provider, url) => {
      if (url.includes('/feeds/')) return new Response('<feed><entry><yt:videoId>short123456</yt:videoId><title>Short</title><link href="https://www.youtube.com/watch?v=short123456"/></entry></feed>')
      if (url.includes('/shorts?')) return new Response(tab('shorts', { reelItemRenderer: { videoId: 'short123456', headline: { simpleText: 'Short' } } }))
      if (url.includes('/videos?')) return new Response(tab('videos', { videoRenderer: { videoId: 'video123456', title: { simpleText: 'Regular' } } }))
      if (url.includes('/watch?')) { const id = new URL(url).searchParams.get('v'); return new Response(`var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: { videoId: id, viewCount: '17' }, microformat: { playerMicroformatRenderer: { publishDate: '2026-01-04' } } })};`) }
      return new Response('Consent required')
    } },
  })
  const data = await (await GET({})).json()
  assert.equal(data.short.id, 'short123456')
  assert.equal(data.short.isShort, true)
  assert.equal(data.short.url, 'https://www.youtube.com/shorts/short123456')
  assert.equal(data.longform.id, 'video123456')
  assert.equal(data.longform.isShort, false)
})

test('embed checks accept only video IDs, use oEmbed and never return provider HTML', async () => {
  let calls = 0
  const { GET } = loadTypescript('app/api/youtube/embed/route.ts', {
    'next/server': nextServer,
    '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed: true }) },
    '@/lib/provider-monitor.mjs': { monitoredFetch: async () => { calls++; return Response.json({ type: 'video', html: '<script>untrusted</script>' }) } },
  })
  const request = (id) => ({ nextUrl: new URL(`https://test.invalid/api/youtube/embed?id=${encodeURIComponent(id)}`) })
  assert.equal((await GET(request('https://other.test'))).status, 400)
  assert.equal(calls, 0)
  assert.deepEqual(await (await GET(request('video123456'))).json(), { available: true })
})

test('official channel stats preserve zero counts, hide private subscribers and fall back on API failures', async () => {
  const original = process.env.YOUTUBE_API_KEY
  process.env.YOUTUBE_API_KEY = 'test-only-key'
  try {
    for (const apiFails of [false, true]) {
      const { GET } = loadTypescript('app/api/youtube/route.ts', {
        'next/server': nextServer,
        '@/lib/youtube-feed.mjs': parsers,
        '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed: true }) },
        '@/lib/provider-monitor.mjs': { monitoredFetch: async (_provider, url) => {
          if (new URL(url).hostname === 'www.googleapis.com') return apiFails ? new Response('', { status: 403 }) : Response.json({ items: [{ snippet: { title: 'Official channel' }, statistics: { viewCount: '0', videoCount: '0', subscriberCount: '123', hiddenSubscriberCount: true } }] })
          if (url.includes('/about')) return new Response('var ytInitialData = {"contents":{"aboutChannelViewModel":{"viewCountText":"12 views"}}};')
          return new Response('Consent required')
        } },
      })
      const data = await (await GET({})).json()
      assert.equal(data.channel.totalViews, apiFails ? '12 views' : '0')
      assert.equal(data.channel.subscribers, undefined)
      assert.equal(data.uploadsUnavailable, true)
      assert.equal(data.live.status, 'unknown')
      assert.equal(JSON.stringify(data).includes('test-only-key'), false)
    }
  } finally {
    if (original === undefined) delete process.env.YOUTUBE_API_KEY
    else process.env.YOUTUBE_API_KEY = original
  }
})

test('accepts YouTube feed links with attributes in any order and falls back to a canonical watch URL', () => {
  const feed = `<feed><entry><yt:videoId>new-id</yt:videoId><title>Newest video</title><published>2026-01-03T00:00:00Z</published><link href="https://www.youtube.com/watch?v=new-id&amp;feature=share" rel="alternate"/></entry><entry><yt:videoId>fallback-id</yt:videoId><title>Fallback video</title></entry></feed>`
  const videos = parseLatestYoutubeVideos(feed)
  assert.equal(videos.longform?.url, 'https://www.youtube.com/watch?v=new-id&feature=share')
  assert.equal(parseLatestYoutubeVideos(`<feed><entry><yt:videoId>fallback-id</yt:videoId><title>Fallback video</title></entry></feed>`).longform?.url, 'https://www.youtube.com/watch?v=fallback-id')
})
