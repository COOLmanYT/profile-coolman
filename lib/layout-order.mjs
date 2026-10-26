import { siteConfig, isModuleAvailable } from './site-config.mjs'

const PAGE_MODULES = ['status', 'views', 'likes', 'share', 'seasons', 'analytics', 'easterEgg']
export const PROFILE_MODULES = Object.keys(siteConfig.modules).filter(id => !PAGE_MODULES.includes(id))
// Only spatial features belong in ordering controls. Behaviour flags and fixed
// overlays (for example an avatar decoration) remain visibility controls.
export const FEATURE_ORDER_GROUPS = {
  profile: { Details: ['avatar', 'bio', 'location'] },
  github: { Sections: ['profile', 'status', 'stats', 'graph', 'projects'], Statistics: ['stats', 'commits'], 'Project metadata': ['language', 'licence'] },
  spotify: { Sections: ['widget', 'history'], Playback: ['position', 'embed'] },
  twitch: { Sections: ['profile', 'stats', 'live', 'schedule'] },
  discord: { Sections: ['banner', 'profile', 'status', 'music', 'video', 'games', 'other'], 'Profile details': ['badges', 'devices', 'decoration'] },
  youtube: { Sections: ['stats', 'live', 'latest'] },
  roblox: { 'Profile details': ['name', 'username'], Statistics: ['friends', 'followers', 'following'] },
  steam: { 'Profile details': ['name', 'username'], Sections: ['game', 'activity'], Statistics: ['hours', 'library'] },
  buymeacoffee: { 'Profile details': ['name', 'username'], Sections: ['cover', 'bio', 'memberships', 'button'], Statistics: ['price', 'supporters'] },
}
export function orderedIds(preferred, available) {
  return [...new Set([...(Array.isArray(preferred) ? preferred.filter(id => available.includes(id)) : []), ...available])]
}
export function normaliseLayout(value, config = siteConfig) {
  const modules = Object.keys(config.modules).filter(id => !PAGE_MODULES.includes(id) && isModuleAvailable(id, config))
  const defaults = config.layout
  const moduleOrder = orderedIds(value?.moduleOrder, orderedIds(defaults.moduleOrder, modules))
  const featureOrder = Object.fromEntries(Object.entries(config.modules).map(([id, module]) => {
    const available = Object.entries(module.features).filter(([, item]) => module.enabled && item.enabled).map(([key]) => `${id}_${key}`)
    return [id, orderedIds(value?.featureOrder?.[id], orderedIds(defaults.featureOrder[id], available))]
  }))
  return { moduleOrder, featureOrder }
}
export function validLayout(value) {
  if (!value || !Array.isArray(value.moduleOrder) || !value.featureOrder || typeof value.featureOrder !== 'object' || Array.isArray(value.featureOrder)) return false
  const available = normaliseLayout(null)
  const valid = (items, allowed) => Array.isArray(items) && items.every(id => typeof id === 'string' && allowed.includes(id)) && new Set(items).size === items.length
  return valid(value.moduleOrder, available.moduleOrder) && Object.entries(value.featureOrder).every(([id, items]) => Object.hasOwn(available.featureOrder, id) && valid(items, available.featureOrder[id]))
}
