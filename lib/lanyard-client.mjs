import { fetchWidgetJson } from './widget-polling.mjs'

export const EMPTY_PRESENCE = { presence: null, unavailable: false, ready: false }

/** One socket and REST fallback per page, regardless of the number of widgets. */
export function createLanyardStore({
  fetchPresence = signal => fetchWidgetJson('/api/discord', signal),
  socketFactory = url => new WebSocket(url),
  visibility = globalThis.document,
  timers = globalThis,
  random = Math.random,
  now = Date.now,
} = {}) {
  const listeners = new Set()
  let snapshot = EMPTY_PRESENCE
  let socket, controller, reconnectTimer, heartbeatTimer, watchdogTimer, restTimer, expiryTimer
  let userId, failures = 0, generation = 0, live = false

  const publish = value => {
    snapshot = value
    for (const listener of listeners) listener()
  }
  const active = () => listeners.size > 0 && !visibility.hidden
  const clear = key => timers.clearTimeout(key)

  function accept(presence, fromSocket = false) {
    if (!presence || !['online', 'idle', 'dnd', 'offline'].includes(presence.discord_status)) return false
    clear(expiryTimer)
    if (fromSocket) {
      live = true
      presence = { ...presence, activity_estimate: snapshot.presence?.activity_estimate ?? null }
    }
    presence = { ...presence, activities: Array.isArray(presence.activities) ? presence.activities.filter(a => a && typeof a.name === 'string' && Number.isInteger(a.type) && a.type >= 0 && a.type <= 5) : [] }
    publish({ presence, ready: true, unavailable: false })
    // An ended song must not remain "playing" if no further event arrives.
    const end = presence.spotify?.timestamps?.end
    if (presence.listening_to_spotify && Number.isFinite(end)) {
      expiryTimer = timers.setTimeout(() => {
        if (snapshot.presence?.spotify === presence.spotify) publish({ ...snapshot, presence: { ...snapshot.presence, listening_to_spotify: false, spotify: null } })
      }, Math.max(0, end - now()))
    }
    return true
  }

  function closeSocket() {
    clear(heartbeatTimer)
    clear(watchdogTimer)
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
      socket.close()
      socket = undefined
    }
  }

  function reconnect() {
    live = false
    closeSocket()
    clear(expiryTimer)
    publish({ presence: null, ready: true, unavailable: true })
    if (!active()) return
    clear(reconnectTimer)
    const delay = Math.min(60_000, 1000 * 2 ** Math.min(failures++, 6)) * (0.8 + random() * 0.4)
    reconnectTimer = timers.setTimeout(connect, delay)
    // Do not make a REST request for each reconnect attempt.
    if (!restTimer) restTimer = timers.setTimeout(() => { restTimer = undefined; void bootstrap() }, 60_000)
  }

  function connect() {
    if (!active() || !userId || socket) return
    try {
      const current = socketFactory('wss://api.lanyard.rest/socket')
      socket = current
      // Covers connection stalls and sockets that open but never send INIT_STATE.
      watchdogTimer = timers.setTimeout(reconnect, 15_000)
      current.onmessage = event => {
        if (socket !== current || !active()) return
        try {
          const message = JSON.parse(event.data)
          if (message.op === 1) {
            const interval = message.d?.heartbeat_interval
            if (!Number.isFinite(interval) || interval < 1000 || interval > 120_000) return reconnect()
            current.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }))
            clear(heartbeatTimer)
            const heartbeat = () => {
              if (socket !== current) return
              if (current.readyState !== 1) return reconnect()
              current.send(JSON.stringify({ op: 3 }))
              heartbeatTimer = timers.setTimeout(heartbeat, interval)
            }
            heartbeatTimer = timers.setTimeout(heartbeat, interval)
          } else if (message.op === 0 && ['INIT_STATE', 'PRESENCE_UPDATE'].includes(message.t)) {
            if (!accept(message.d, true)) return reconnect()
            failures = 0
            clear(watchdogTimer)
          }
        } catch { reconnect() }
      }
      current.onclose = current.onerror = () => { if (socket === current) reconnect() }
    } catch { reconnect() }
  }

  async function bootstrap() {
    if (!active() || controller) return
    const epoch = generation
    const request = new AbortController()
    controller = request
    const timeout = timers.setTimeout(() => request.abort(), 10_000)
    try {
      const presence = await fetchPresence(request.signal)
      if (request.signal.aborted || epoch !== generation || !active()) return
      userId = presence.userId ?? presence.discord_user?.id
      // REST also updates the existing saved game-time badges once per minute.
      // It must never replace newer live playback with a cached REST snapshot.
      if (live && snapshot.presence) {
        publish({ ...snapshot, presence: { ...snapshot.presence, activity_estimate: presence.activity_estimate ?? null } })
      } else if (!accept(presence)) throw new Error('Invalid Lanyard presence')
      if (typeof userId !== 'string' || !/^\d+$/.test(userId)) throw new Error('Missing Discord ID')
      connect()
    } catch {
      if (epoch !== generation || !active()) return
      if (!live) publish({ presence: null, ready: true, unavailable: true })
    } finally {
      clear(timeout)
      if (controller === request) controller = undefined
      if (epoch === generation && active() && !restTimer) {
        restTimer = timers.setTimeout(() => { restTimer = undefined; void bootstrap() }, 60_000)
      }
    }
  }

  function pause() {
    live = false
    generation++
    controller?.abort()
    controller = undefined
    closeSocket()
    for (const timer of [reconnectTimer, restTimer, expiryTimer]) clear(timer)
    restTimer = undefined
    snapshot = EMPTY_PRESENCE
  }
  function visibilityChanged() {
    if (visibility.hidden) { pause(); publish(EMPTY_PRESENCE) }
    else void bootstrap()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        visibility.addEventListener('visibilitychange', visibilityChanged)
        void bootstrap()
      }
      return () => {
        listeners.delete(listener)
        if (!listeners.size) {
          pause()
          visibility.removeEventListener('visibilitychange', visibilityChanged)
        }
      }
    },
  }
}
