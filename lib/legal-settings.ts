import { getSupabase } from './supabase-server'

export type LegalSettings = { simpleModeDefault: boolean }

const SETTINGS_ID = 'legal'
export const DEFAULT_LEGAL_SETTINGS: LegalSettings = { simpleModeDefault: true }

function normalise(value: unknown): LegalSettings {
  if (!value || typeof value !== 'object') return DEFAULT_LEGAL_SETTINGS
  const simpleModeDefault = (value as Record<string, unknown>).simpleModeDefault
  return { simpleModeDefault: typeof simpleModeDefault === 'boolean' ? simpleModeDefault : true }
}

export async function getLegalSettings(): Promise<LegalSettings> {
  const supabase = getSupabase()
  if (!supabase) return DEFAULT_LEGAL_SETTINGS
  const { data, error } = await supabase.from('site_settings').select('value').eq('id', SETTINGS_ID).maybeSingle()
  return error || !data ? DEFAULT_LEGAL_SETTINGS : normalise(data.value)
}

export async function saveLegalSettings(settings: LegalSettings) {
  const supabase = getSupabase()
  if (!supabase) return false
  const { error } = await supabase
    .from('site_settings')
    .upsert({ id: SETTINGS_ID, value: settings, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  return !error
}
