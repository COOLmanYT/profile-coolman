import { getSupabase } from './supabase-server'
import { DEFAULT_SEASONAL_SETTINGS, normaliseSeasonalSettings, type SeasonalSettings } from './seasonal'

const SETTINGS_ID = 'seasonal'

export async function getSeasonalSettings(): Promise<SeasonalSettings> {
  const supabase = getSupabase()
  if (!supabase) return DEFAULT_SEASONAL_SETTINGS
  const { data, error } = await supabase.from('site_settings').select('value').eq('id', SETTINGS_ID).maybeSingle()
  if (error || !data) return DEFAULT_SEASONAL_SETTINGS
  return normaliseSeasonalSettings(data.value)
}

export async function saveSeasonalSettings(settings: SeasonalSettings) {
  const supabase = getSupabase()
  if (!supabase) return false
  const { error } = await supabase
    .from('site_settings')
    .upsert({ id: SETTINGS_ID, value: settings, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  return !error
}
