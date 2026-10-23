'use client'

import { useSyncExternalStore } from 'react'
import { createLanyardStore, EMPTY_PRESENCE } from './lanyard-client.mjs'

export interface LanyardPresence {
  userId?: string
  discord_status: 'online' | 'idle' | 'dnd' | 'offline'
  activities: Array<{ name: string; type: number }>
  discord_user?: { id: string; username: string }
  listening_to_spotify?: boolean
  spotify?: {
    track_id: string
    song: string
    artist: string
    album_art_url?: string
    timestamps: { start: number; end: number }
  } | null
}

// Construction is lazy: SSR must neither share visitor state nor open sockets.
let store: ReturnType<typeof createLanyardStore> | undefined
const getStore = () => store ??= createLanyardStore()
const subscribe = (listener: () => void) => getStore().subscribe(listener)
const getSnapshot = () => getStore().getSnapshot()
const getServerSnapshot = () => EMPTY_PRESENCE

export function useLanyard() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) as {
    presence: LanyardPresence | null
    ready: boolean
    unavailable: boolean
  }
}
