import { createClient } from '@supabase/supabase-js'

export type StatusSettings = { profileComponentName: string; brandComponentName: string }
const SETTINGS_ID = 'status'
export const DEFAULT_STATUS_SETTINGS: StatusSettings = { profileComponentName: 'Profile page', brandComponentName: 'COOLman brand' }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return !url || !key || url.includes('placeholder') ? null : createClient(url, key)
}

function normalise(value: unknown): StatusSettings {
  if (!value || typeof value !== 'object') return DEFAULT_STATUS_SETTINGS
  const data = value as Record<string, unknown>
  return {
    profileComponentName: typeof data.profileComponentName === 'string' && data.profileComponentName.trim() ? data.profileComponentName.trim() : DEFAULT_STATUS_SETTINGS.profileComponentName,
    brandComponentName: typeof data.brandComponentName === 'string' && data.brandComponentName.trim() ? data.brandComponentName.trim() : DEFAULT_STATUS_SETTINGS.brandComponentName,
  }
}

export async function getStatusSettings(): Promise<StatusSettings> {
  const supabase = getSupabase()
  if (!supabase) return DEFAULT_STATUS_SETTINGS
  const { data, error } = await supabase.from('site_settings').select('value').eq('id', SETTINGS_ID).maybeSingle()
  return error || !data ? DEFAULT_STATUS_SETTINGS : normalise(data.value)
}

export async function saveStatusSettings(settings: StatusSettings) {
  const supabase = getSupabase()
  if (!supabase) return false
  const { error } = await supabase.from('site_settings').upsert({ id: SETTINGS_ID, value: normalise(settings), updated_at: new Date().toISOString() }, { onConflict: 'id' })
  return !error
}
