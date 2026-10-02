import { getSupabase } from './supabase-server'
import { DEFAULT_TOGGLES } from './toggle-defaults.mjs'
export { DEFAULT_TOGGLES } from './toggle-defaults.mjs'

export async function getToggles(): Promise<Record<string, boolean>> {
  const defaults: Record<string, boolean> = { ...DEFAULT_TOGGLES }
  try {
    const supabase = getSupabase()
    if (!supabase) return defaults
    const { data, error } = await supabase.from('toggles').select('id, value')
    if (error) return defaults
    for (const row of data ?? []) {
      if (Object.hasOwn(defaults, row.id) && typeof row.value === 'boolean') defaults[row.id] = row.value
    }
  } catch {
    // Keep the public profile available when the settings database is unavailable.
  }
  return defaults
}
