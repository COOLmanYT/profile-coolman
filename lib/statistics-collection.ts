import { siteConfig, isModuleAvailable } from './site-config.mjs'
import { getSupabase } from './supabase-server'

export type CollectionPolicy = Record<keyof typeof siteConfig.analytics.collect, boolean>
export async function readSmallJson(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length')) > 4096) throw new Error('Body too large')
  const reader = request.body?.getReader()
  if (!reader) return {}
  const decoder = new TextDecoder()
  let size = 0, text = '', timedOut = false
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}) }, 1500)
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) { await reader.cancel(); throw new Error('Body too large') }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    if (timedOut) throw new Error('Body timed out')
  } finally { clearTimeout(timer); reader.releaseLock() }
  const value = JSON.parse(text || '{}')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid body')
  return value
}

export async function getCollectionPolicy(): Promise<CollectionPolicy> {
  const disabled = Object.fromEntries(Object.keys(siteConfig.analytics.collect).map(key => [key, false])) as CollectionPolicy
  if (!siteConfig.analytics.enabled || !isModuleAvailable('analytics') || !Object.values(siteConfig.analytics.collect).some(Boolean)) return disabled
  try {
    const supabase = getSupabase()
    if (!supabase) return disabled
    const { data, error } = await supabase.from('toggles').select('value').eq('id', 'analytics').maybeSingle()
    if (error || (typeof data?.value === 'boolean' ? !data.value : !siteConfig.modules.analytics.default)) return disabled
    return { ...siteConfig.analytics.collect }
  } catch { return disabled }
}
