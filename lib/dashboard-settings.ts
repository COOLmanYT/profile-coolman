import { getSupabase } from './supabase-server'
import { normaliseLayout } from './layout-order.mjs'
import { siteConfig } from './site-config.mjs'
import { readAnnouncement } from './live-announcement.mjs'

export async function readDashboardSetting(id: string): Promise<unknown> {
  try {
    const db = getSupabase()
    if (!db) return undefined
    const { data, error } = await db.from('site_settings').select('value').eq('id', id).maybeSingle()
    return error ? undefined : data?.value
  } catch { return undefined }
}
export async function writeDashboardSetting(id: string, value: unknown) {
  try {
    const db = getSupabase()
    if (!db) return false
    const { data, error } = await db.from('site_settings').upsert({ id, value, updated_at: new Date().toISOString() }, { onConflict: 'id' }).select('value').single()
    return !error && data?.value !== undefined
  } catch { return false }
}
export async function getLayoutSettings() {
  return normaliseLayout(siteConfig.dashboard.features.ordering ? await readDashboardSetting('profile-layout') : undefined)
}
export type Announcement = { message: string; url: string | null }
export async function getManagedAnnouncement(): Promise<Announcement | null | undefined> {
  if (siteConfig.announcement.source === 'lanyard') return undefined
  const saved = siteConfig.dashboard.features.announcements ? await readDashboardSetting('profile-announcement') : undefined
  if (saved && typeof saved === 'object') {
    const record = saved as { message?: unknown; url?: unknown }
    return readAnnouncement({ announcement: record.message, announcement_url: record.url })
  }
  const configured = readAnnouncement({ announcement: siteConfig.announcement.message, announcement_url: siteConfig.announcement.url })
  return configured ?? (siteConfig.announcement.source === 'dashboard' ? null : undefined)
}
