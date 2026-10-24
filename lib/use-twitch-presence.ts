'use client'

import { useEffect, useState } from 'react'
import { startPolling, fetchWidgetJson } from './widget-polling.mjs'

export interface TwitchPresence {
  isLive: boolean
  title?: string
  game?: string
  viewers?: number
  followers?: number | null
  subscribers?: number | null
  thumbnailUrl?: string
  startedAt?: string
  tags?: string[]
  channelName?: string
  channelLogin?: string
  profileImageUrl?: string
  description?: string
  broadcasterType?: string
  channelUrl?: string
  nextStream?: { title?: string; category?: string; startsAt: string }
}

const EMPTY = { presence: null, loaded: false, isUnavailable: false }
export interface TwitchState { presence: TwitchPresence | null; loaded: boolean; isUnavailable: boolean }

/** The profile owns one poll; the hero and channel card share its snapshot. */
export function useTwitchPresence(enabled: boolean): TwitchState {
  const [state, setState] = useState<TwitchState>(EMPTY)
  useEffect(() => {
    if (!enabled) return
    const clearHiddenSnapshot = () => { if (document.hidden) setState(EMPTY) }
    document.addEventListener('visibilitychange', clearHiddenSnapshot)
    const stop = startPolling({
      intervalMs: 30_000,
      poll: async (signal: AbortSignal) => {
        const presence = await fetchWidgetJson('/api/twitch', signal) as TwitchPresence
        if (!signal.aborted) setState({ presence, loaded: true, isUnavailable: false })
      },
      onError: () => setState(current => ({ ...current, loaded: true, isUnavailable: true })),
    })
    return () => { stop(); document.removeEventListener('visibilitychange', clearHiddenSnapshot) }
  }, [enabled])
  return enabled ? state : EMPTY
}
