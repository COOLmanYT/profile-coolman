export const MAX_SESSION_BACKFILL_MS = 24 * 60 * 60 * 1000
const MAX_UNTIMED_GAP_MS = 90_000

/** Count only Playing activities. Application IDs keep e.g. Roblox experiences together. */
export function observeDiscordGames(previous, activities, now = Date.now(), trackedAfter = 0) {
  // A confirmed progress snapshot replaces older estimated hours. Keep known game IDs
  // so recalibration cannot count the same application as a new distinct game.
  if (previous && (previous.baselineAt ?? 0) > trackedAfter) return previous
  const state = previous && (previous.baselineAt ?? 0) === trackedAfter ? previous
    : { baselineAt: trackedAfter, gameTimeMs: 0, games: previous?.games ?? [], activeGames: [], lastObservedAt: 0, lastCreditedAt: trackedAfter, trackedSince: Math.max(now, trackedAfter) }
  if (!Number.isFinite(now) || now <= state.lastObservedAt) return state
  const playing = (Array.isArray(activities) ? activities : []).filter(activity =>
    activity?.type === 0 && typeof activity.name === 'string' && activity.name.trim()
  ).slice(0, 10)
  const games = new Set(state.games)
  const activeGames = new Set()
  let earliestStart = now
  for (const activity of playing) {
    const key = typeof activity.application_id === 'string' && /^\d{1,20}$/.test(activity.application_id)
      ? `app:${activity.application_id}` : `name:${activity.name.trim().toLowerCase().slice(0, 128)}`
    activeGames.add(key)
    if (games.size < 1000) games.add(key)
    const start = activity.timestamps?.start
    if (typeof start === 'number' && Number.isFinite(start) && start > 0 && start <= now) {
      // A session timestamp can estimate time before the first visit, bounded to 24h.
      earliestStart = Math.min(earliestStart, Math.max(start, now - MAX_SESSION_BACKFILL_MS))
    } else if (state.activeGames.includes(key) && now - state.lastObservedAt <= MAX_UNTIMED_GAP_MS) {
      // Without a timestamp, only count closely spaced observations of the same game.
      earliestStart = Math.min(earliestStart, state.lastObservedAt)
    }
  }
  // All current intervals end at now: their union starts at the earliest start.
  // A shared watermark prevents repeat polls, concurrent games and tabs multiplying time.
  const delta = Math.max(0, now - Math.max(earliestStart, state.lastCreditedAt))
  return {
    baselineAt: state.baselineAt ?? 0, gameTimeMs: state.gameTimeMs + delta,
    games: [...games], activeGames: [...activeGames], lastObservedAt: now,
    lastCreditedAt: Math.max(now, trackedAfter), // Empty/offline observations also close the backfill window.
    trackedSince: state.trackedSince,
  }
}

export function gameEstimateTotals(state) {
  return { game_time_hours: state.gameTimeMs / 3_600_000, games_played: state.games.length, tracked_since: new Date(state.trackedSince).toISOString() }
}

/** Optimistic locking makes updates safe across server instances and visitors. */
export async function persistDiscordGameEstimate(supabase, userId, activities, now = Date.now(), revision = () => globalThis.crypto.randomUUID(), trackedAfter = 0) {
  if (!supabase) return null
  // Isolate current counters from immutable older previews using the legacy key.
  const legacyId = "discord_activity_estimates:" + userId
  const id = "discord_activity_estimates:v2:" + userId
  const signal = AbortSignal.timeout(3000)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: row, error } = await supabase.from('site_settings').select('value').eq('id', id).abortSignal(signal).maybeSingle()
    if (error) throw new Error('Could not read Discord activity estimates', { cause: error })
    let previous = row?.value
    if (!row) {
      // Import existing counters once, then ignore subsequent legacy preview writes.
      const legacy = await supabase.from('site_settings').select('value').eq('id', legacyId).abortSignal(signal).maybeSingle()
      if (legacy.error) throw new Error('Could not import Discord activity estimates', { cause: legacy.error })
      previous = legacy.data?.value
    }
    if (previous && (typeof previous.revision !== 'string' || !Array.isArray(previous.games) || !Array.isArray(previous.activeGames)
      || ![previous.gameTimeMs, previous.lastObservedAt, previous.lastCreditedAt, previous.trackedSince].every(value => Number.isFinite(value) && value >= 0))) {
      throw new Error('Invalid stored Discord activity estimates')
    }
    const state = observeDiscordGames(previous, activities, now, trackedAfter)
    if (state === previous && row) return gameEstimateTotals(state)
    const value = { ...state, revision: revision() }
    if (!row) {
      const result = await supabase.from('site_settings').insert({ id, value, updated_at: new Date(now).toISOString() }).abortSignal(signal)
      if (!result.error) return gameEstimateTotals(state)
      if (result.error.code === '23505') continue
      throw new Error('Could not create Discord activity estimates', { cause: result.error })
    }
    const result = await supabase.from('site_settings').update({ value, updated_at: new Date(now).toISOString() })
      .eq('id', id).eq('value->>revision', previous.revision).select('id').abortSignal(signal).maybeSingle()
    if (result.error) throw new Error('Could not save Discord activity estimates', { cause: result.error })
    if (result.data) return gameEstimateTotals(state)
  }
  throw new Error('Discord activity estimate update conflicted')
}
