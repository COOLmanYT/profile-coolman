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
export type Announcement = NonNullable<ReturnType<typeof readAnnouncement>>
export async function getManagedAnnouncement(): Promise<Announcement | null | undefined> {
  if (siteConfig.announcement.source === 'lanyard') return undefined
  const saved = siteConfig.dashboard.features.announcements ? await readDashboardSetting('profile-announcement') : undefined
  if (saved && typeof saved === 'object') {
    const record = saved as Partial<Record<keyof Announcement, unknown>>
    return readAnnouncement({ announcement: record.message, announcement_url: record.url, announcement_label: record.label, announcement_link_text: record.linkText, announcement_placement: record.placement })
  }
  const configured = readAnnouncement({ announcement: siteConfig.announcement.message, announcement_url: siteConfig.announcement.url, announcement_label: siteConfig.announcement.label, announcement_link_text: siteConfig.announcement.linkText, announcement_placement: siteConfig.announcement.placement })
  return configured ?? (siteConfig.announcement.source === 'dashboard' ? null : undefined)
}
