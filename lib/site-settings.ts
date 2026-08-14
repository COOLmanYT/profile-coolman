import { createClient } from '@supabase/supabase-js'
import { DEFAULT_SEASONAL_SETTINGS, normaliseSeasonalSettings, type SeasonalSettings } from './seasonal'

const SETTINGS_ID = 'seasonal'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

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
