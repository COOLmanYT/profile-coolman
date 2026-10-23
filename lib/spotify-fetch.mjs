import { retryAfterMs } from './widget-polling.mjs'

export class SpotifyCooldownError extends Error {
  constructor(retryMs) {
    super('Spotify rate limited')
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryMs / 1000))
  }
}

/** App-wide within this function instance, including playback, history and tokens. */
export function createSpotifyFetcher(fetcher, now = Date.now) {
  let blockedUntil = 0
  return async (url, init) => {
    if (now() < blockedUntil) throw new SpotifyCooldownError(blockedUntil - now())
    const response = await fetcher('spotify', url, init)
    if (response.status === 429) {
      const delay = retryAfterMs(response.headers.get('Retry-After'), now()) || 60_000
      blockedUntil = now() + delay
      throw new SpotifyCooldownError(delay)
    }
    return response
  }
}
