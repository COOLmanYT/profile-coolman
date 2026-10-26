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
export function featureOrderGroups(module, order) {
  const groups = FEATURE_ORDER_GROUPS[module] ?? { Features: order.map(key => key.slice(module.length + 1)) }
  // The statistics row still exists when only its commit count is available.
  if (module === 'github' && !order.includes('github_stats')) return { ...groups, Sections: FEATURE_ORDER_GROUPS.github.Sections.map(part => part === 'stats' ? 'commits' : part) }
  return groups
}

/** Preserve each other logical parent's ordering when groups share an anchor. */
export function reorderFeatures(order, next, groups) {
  let index = 0
  const preferred = order.map(key => next.includes(key) ? next[index++] : key)
  const before = new Map(order.map(key => [key, new Set()]))
  for (const group of groups) {
    const current = order.filter(key => group.includes(key))
    const items = current.length === next.length && current.every(key => next.includes(key)) ? next : current
    for (let i = 1; i < items.length; i++) before.get(items[i]).add(items[i - 1])
  }
  const remaining = new Set(preferred), result = []
  while (remaining.size) {
    const key = preferred.find(key => remaining.has(key) && [...before.get(key)].every(parent => !remaining.has(parent)))
    if (key === undefined) return order
    remaining.delete(key); result.push(key)
  }
  return result
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
