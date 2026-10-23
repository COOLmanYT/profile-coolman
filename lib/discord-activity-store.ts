import { DISCORD_BADGE_DEFAULTS } from './discord-achievements'
import { getSupabase } from './supabase-server'
import { persistDiscordGameEstimate } from './discord-activity-estimates.mjs'
import { createTtlCache } from './ttl-cache.mjs'

// The profile has one configured Discord owner. Coalesce its visitor-driven polls.
const cache = createTtlCache({ ttlMs: 15_000, staleOnError: false })

export async function recordDiscordGameEstimate(userId: string, activities: unknown[]) {
  try {
    return await cache.get(() => persistDiscordGameEstimate(getSupabase(), userId, activities, Date.now(), undefined, Date.parse(DISCORD_BADGE_DEFAULTS.discord_game_time_baseline_at)))
  } catch {
    // Storage must not take down otherwise healthy presence or pretend a save succeeded.
    return null
  }
}
