import { DEFAULT_TOGGLES } from './toggle-defaults.mjs'

export const MODULES = ['spotify', 'twitch', 'discord', 'youtube', 'roblox', 'steam', 'buymeacoffee']
export const VISIBILITY_KEY = 'coolman-visibility-preferences-v1'
export const MEDIA_KEY = 'coolman-media-preferences'
export const DEFAULT_MEDIA = Object.freeze({ showYoutube: true, showYoutubeStats: true, showLatestUpload: true, showYoutubeLive: true, youtubeFormat: 'both', youtubeEmbed: 'default', scheduleTimeZone: null })

export function normaliseVisibility(value) {
  const list = (items, allowed) => Array.isArray(items) ? [...new Set(items.filter((item) => typeof item === 'string' && allowed.includes(item)))] : []
  return { hiddenModules: list(value?.hiddenModules, MODULES), hiddenFeatures: list(value?.hiddenFeatures, Object.keys(DEFAULT_TOGGLES).filter((key) => !MODULES.includes(key))) }
}

export function readVisibility(storage) {
  try { return normaliseVisibility(JSON.parse(storage.getItem(VISIBILITY_KEY) ?? '{}')) }
  catch { return normaliseVisibility(null) }
}

export function writeVisibility(storage, value) {
  try { storage.setItem(VISIBILITY_KEY, JSON.stringify(normaliseVisibility(value))) } catch { /* Storage is optional. */ }
}

export function resetStoredPreferences(storage, session) {
  // Keep likes, authentication and unrelated browser storage intact.
  for (const key of [VISIBILITY_KEY, MEDIA_KEY, 'coolman-legal-simple-mode', 'coolman-seasonal-preference']) {
    try { storage.removeItem(key) } catch { /* Storage is optional. */ }
  }
  try { session.removeItem('coolman-seasonal-once') } catch { /* Storage is optional. */ }
}
