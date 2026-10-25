import { configuredGroups, siteConfig } from './site-config.mjs'

export const DASHBOARD_GROUPS = configuredGroups()
export const DASHBOARD_LABELS = Object.fromEntries(Object.entries(siteConfig.modules).flatMap(([id, module]) => [[id, 'Entire module'], ...Object.entries(module.features).map(([key, value]) => [`${id}_${key}`, value.label])]))

const SECTION_PARENTS = Object.fromEntries([
  ['twitch_takeover', 'twitch_live'],
  ...['github_commit_titles', 'github_language', 'github_licence'].map((key) => [key, 'github_projects']),
  ...['roblox_friends', 'roblox_followers', 'roblox_following'].map((key) => [key, 'roblox_stats']),
  ...['steam_status', 'steam_game', 'steam_hours', 'steam_library'].map((key) => [key, 'steam_activity']),
])

export function isControlDisabled(key, parentKey, toggles) {
  return (key !== parentKey && toggles[parentKey] === false) || (SECTION_PARENTS[key] !== undefined && toggles[SECTION_PARENTS[key]] === false)
}
