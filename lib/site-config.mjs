import config from '../site.config.json' with { type: 'json' }
import { validateSiteConfig } from './config-validation.mjs'

/** Public build-time configuration. Never place credentials in this file. */
validateSiteConfig(config)
export const siteConfig = config

export function isModuleAvailable(id, source = siteConfig) {
  return source.modules[id]?.enabled === true
}

export function isControlAvailable(key, source = siteConfig) {
  return Object.entries(source.modules).some(([id, module]) => module.enabled &&
    (key === id || Object.entries(module.features).some(([feature, value]) => `${id}_${feature}` === key && value.enabled)))
}

export function configuredDefaults(source = siteConfig) {
  return Object.fromEntries(Object.entries(source.modules).flatMap(([id, module]) => [
    [id, module.enabled && module.default],
    ...Object.entries(module.features).map(([feature, value]) => [`${id}_${feature}`, module.enabled && value.enabled && value.default]),
  ]))
}

/** Availability wins over DB values, visitor preferences and dashboard previews. */
export function applyModulePolicy(values, source = siteConfig) {
  const defaults = configuredDefaults(source)
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) =>
    [key, isControlAvailable(key, source) && (typeof values[key] === 'boolean' ? values[key] : fallback)]))
}

export function configuredGroups(source = siteConfig) {
  return Object.entries(source.modules).filter(([, module]) => module.enabled).map(([id, module]) => ({
    title: module.label, description: module.description, parentKey: id,
    keys: [id, ...Object.entries(module.features).filter(([, value]) => value.enabled).map(([feature]) => `${id}_${feature}`)],
  }))
}

export const providerLinks = {
  github: `https://github.com/${siteConfig.providers.github.username}`,
  youtube: `https://www.youtube.com/channel/${siteConfig.providers.youtube.channelId}`,
  twitch: `https://www.twitch.tv/${siteConfig.providers.twitch.login}`,
  roblox: `https://www.roblox.com/users/${siteConfig.providers.roblox.userId}/profile`,
  steam: `https://steamcommunity.com/profiles/${siteConfig.providers.steam.id}`,
  buymeacoffee: `https://buymeacoffee.com/${siteConfig.providers.buymeacoffee.slug}`,
}
