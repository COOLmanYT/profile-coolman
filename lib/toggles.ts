import { getSupabase } from './supabase-server'

export const DEFAULT_TOGGLES: Record<string, boolean> = {
  spotify: true,
  spotify_widget: true,
  spotify_position: true,
  spotify_embed: true,
  spotify_playlist: true,
  spotify_history: true,
  twitch: true,
  youtube: true,
  twitch_profile: true,
  twitch_stats: true,
  twitch_live: true,
  twitch_schedule: true,
  discord: true,
  discord_profile: true,
  discord_banner: true,
  discord_badges: true,
  discord_decoration: true,
  discord_devices: true,
  discord_music: true,
  discord_video: true,
  discord_games: true,
  discord_status: true,
  discord_other: true,
  discord_mobile: true,
  discord_web: true,
  discord_desktop: true,
}

export async function getToggles(): Promise<Record<string, boolean>> {
  const supabase = getSupabase()
  if (!supabase) return { ...DEFAULT_TOGGLES }
  try {
    const { data, error } = await supabase.from('toggles').select('id, value')
    if (error) return { ...DEFAULT_TOGGLES }
    const toggles: Record<string, boolean> = { ...DEFAULT_TOGGLES }
    if (data) {
      for (const row of data as Array<{ id: string; value: boolean }>) {
        toggles[row.id] = row.value
      }
    }
    return toggles
  } catch {
    return { ...DEFAULT_TOGGLES }
  }
}
