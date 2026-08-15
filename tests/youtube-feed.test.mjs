import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLatestYoutubeVideos, parseYoutubeViewCount } from '../lib/youtube-feed.mjs'

test('separates the newest short and long-form YouTube videos', () => {
  const feed = `<feed><entry><yt:videoId>short-id</yt:videoId><title>Short &amp; sweet</title><published>2026-01-02T00:00:00Z</published><link rel="alternate" href="https://www.youtube.com/shorts/short-id"/></entry><entry><yt:videoId>long-id</yt:videoId><title>Long video</title><published>2026-01-01T00:00:00Z</published><link rel="alternate" href="https://www.youtube.com/watch?v=long-id"/></entry></feed>`
  const videos = parseLatestYoutubeVideos(feed)
  assert.equal(videos.short?.title, 'Short & sweet')
  assert.equal(videos.longform?.url, 'https://www.youtube.com/watch?v=long-id')
  assert.equal(videos.short?.id, 'short-id')
  assert.equal(parseYoutubeViewCount('<script>{\"interactionCount\":\"12,345\"}</script>'), 12345)
  assert.equal(parseYoutubeViewCount('<script>{\"viewCount\":987}</script>'), 987)
})

test('accepts YouTube feed links with attributes in any order and falls back to a canonical watch URL', () => {
  const feed = `<feed><entry><yt:videoId>new-id</yt:videoId><title>Newest video</title><published>2026-01-03T00:00:00Z</published><link href="https://www.youtube.com/watch?v=new-id&amp;feature=share" rel="alternate"/></entry><entry><yt:videoId>fallback-id</yt:videoId><title>Fallback video</title></entry></feed>`
  const videos = parseLatestYoutubeVideos(feed)
  assert.equal(videos.longform?.url, 'https://www.youtube.com/watch?v=new-id&feature=share')
  assert.equal(parseLatestYoutubeVideos(`<feed><entry><yt:videoId>fallback-id</yt:videoId><title>Fallback video</title></entry></feed>`).longform?.url, 'https://www.youtube.com/watch?v=fallback-id')
})
