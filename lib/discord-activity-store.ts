import { getSupabase } from './supabase-server'
import { persistDiscordGameEstimate } from './discord-activity-estimates.mjs'
import { createTtlCache } from './ttl-cache.mjs'

// The profile has one configured Discord owner. Coalesce its visitor-driven polls.
const cache = createTtlCache({ ttlMs: 15_000, staleOnError: false })

export async function recordDiscordGameEstimate(userId: string, activities: unknown[]) {
  try {
    return await cache.get(() => persistDiscordGameEstimate(getSupabase(), userId, activities))
  } catch {
    // Storage must not take down otherwise healthy presence or pretend a save succeeded.
    return null
  }
}
