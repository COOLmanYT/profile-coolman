/** Fail at build time with a useful path instead of silently using another profile. */
export function validateSiteConfig(config) {
  const fail = (path, message) => { throw new Error(`site.config.json: ${path} ${message}`) }
  const string = (value, path) => { if (typeof value !== 'string') fail(path, 'must be a string') }
  const choice = (value, values, path) => { if (!values.includes(value)) fail(path, `must be one of ${values.join(', ')}`) }
  const bool = (value, path) => { if (typeof value !== 'boolean') fail(path, 'must be true or false') }
  const object = (value, path) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object') }
  const range = (value, min, max, path) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path, `must be between ${min} and ${max}`) }
  const color = (value, path) => { if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) fail(path, 'must be a six-digit hex colour') }
  const url = (value, path, local = false, optional = false) => {
    string(value, path)
    if (optional && !value) return
    if (local && /^\/(?!\/)[^\s\\]*$/.test(value)) return
    try {
      const parsed = new URL(value)
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return
      if (path === 'site.url' && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) return
    } catch { /* Fail below. */ }
    fail(path, local ? 'must be a /local-path or HTTPS URL' : 'must be an HTTPS URL')
  }
  const rejectSecrets = (value, path = '') => {
    if (!value || typeof value !== 'object') return
    for (const [key, entry] of Object.entries(value)) {
      if (/secret|token|api.?key|password|service.?role/i.test(key)) fail(`${path}${key}`, 'is a secret field; put credentials in server environment variables')
      rejectSecrets(entry, `${path}${key}.`)
    }
  }
  rejectSecrets(config)
  for (const key of ['profile', 'site', 'appearance', 'providers', 'modules']) if (!config?.[key] || typeof config[key] !== 'object') fail(key, 'is required')
  for (const key of ['username', 'bio', 'location']) string(config.profile[key], `profile.${key}`)
  if (!config.profile.username.trim()) fail('profile.username', 'must not be empty')
  url(config.profile.avatar, 'profile.avatar', true)
  range(config.profile.birthday?.month, 1, 12, 'profile.birthday.month')
  range(config.profile.birthday?.day, 1, 31, 'profile.birthday.day')
  const { month, day } = config.profile.birthday
  const birthday = new Date(Date.UTC(2000, month - 1, day))
  if (!Number.isInteger(month) || !Number.isInteger(day) || birthday.getUTCMonth() + 1 !== month || birthday.getUTCDate() !== day) fail('profile.birthday', 'must be a valid calendar month and day')
  url(config.site.url, 'site.url'); url(config.site.repository, 'site.repository')
  string(config.site.contactEmail, 'site.contactEmail'); string(config.site.language, 'site.language')
  const appearance = config.appearance, background = appearance.background
  choice(appearance.defaultMode, ['dark', 'light', 'system'], 'appearance.defaultMode')
  bool(appearance.allowModeSwitch, 'appearance.allowModeSwitch')
  color(appearance.card?.from, 'appearance.card.from'); color(appearance.card?.to, 'appearance.card.to')
  if (!background) fail('appearance.background', 'is required')
  choice(background.type, ['preset', 'color', 'image', 'gif', 'video'], 'appearance.background.type')
  choice(background.preset, ['waves', 'gradient', 'aurora'], 'appearance.background.preset')
  choice(background.animation, ['none', 'drift', 'pulse'], 'appearance.background.animation')
  choice(background.fit, ['cover', 'contain'], 'appearance.background.fit')
  string(background.position, 'appearance.background.position')
  range(background.speed, 0.1, 3, 'appearance.background.speed'); range(background.overlay, 0, 1, 'appearance.background.overlay')
  if (!Array.isArray(background.colors) || background.colors.length < 1 || background.colors.length > 8) fail('appearance.background.colors', 'must contain 1 to 8 colours')
  background.colors.forEach((value, index) => color(value, `appearance.background.colors[${index}]`))
  url(background.src, 'appearance.background.src', true, !['image', 'gif', 'video'].includes(background.type))
  url(background.poster, 'appearance.background.poster', true, true)
  for (const [provider, field, pattern] of [
    ['github', 'username', /^[\w-]+$/], ['youtube', 'channelId', /^UC[\w-]+$/], ['twitch', 'login', /^\w+$/],
    ['roblox', 'userId', /^\d+$/], ['steam', 'id', /^\d{17}$/], ['steam', 'username', /^[\w-]+$/], ['buymeacoffee', 'slug', /^[\w-]+$/],
  ]) {
    string(config.providers[provider]?.[field], `providers.${provider}.${field}`)
    if (!pattern.test(config.providers[provider][field])) fail(`providers.${provider}.${field}`, 'has an invalid identifier')
  }
  if (!config.providers.discord?.badges) fail('providers.discord.badges', 'is required')
  string(config.providers.discord.username, 'providers.discord.username')
  for (const field of ['url', 'componentsUrl']) url(config.providers.status?.[field], `providers.status.${field}`)
  for (const field of ['label', 'profileComponent']) string(config.providers.status[field], `providers.status.${field}`)
  if (!Array.isArray(config.socials)) fail('socials', 'must be an array')
  const labels = new Set()
  config.socials.forEach((social, index) => {
    const path = `socials[${index}]`
    object(social, path)
    string(social.label, `${path}.label`); string(social.icon, `${path}.icon`); url(social.url, `${path}.url`); bool(social.enabled, `${path}.enabled`)
    if (labels.has(social.label)) fail(`${path}.label`, 'must be unique')
    labels.add(social.label)
  })
  const controlIds = new Set(Object.keys(config.modules))
  for (const [id, module] of Object.entries(config.modules)) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(id)) fail(`modules.${id}`, 'must use a camelCase module ID')
    const path = `modules.${id}`
    object(module, path)
    bool(module.enabled, `${path}.enabled`); bool(module.default, `${path}.default`)
    string(module.label, `${path}.label`); string(module.description, `${path}.description`)
    if (!module.features || typeof module.features !== 'object' || Array.isArray(module.features)) fail(`${path}.features`, 'must be an object')
    for (const [key, feature] of Object.entries(module.features)) {
      object(feature, `${path}.features.${key}`)
      if (!/^[a-z][a-z0-9_]*$/.test(key)) fail(`${path}.features.${key}`, 'has an invalid feature ID')
      const control = `${id}_${key}`
      if (controlIds.has(control)) fail(control, 'duplicates another control')
      controlIds.add(control)
      bool(feature.enabled, `${path}.features.${key}.enabled`); bool(feature.default, `${path}.features.${key}.default`); string(feature.label, `${path}.features.${key}.label`)
    }
  }
  return config
}

/** Derive exact origins from trusted, validated configuration; never weaken CSP to https: *. */
export function configuredMediaOrigins(config) {
  return [...new Set([config.profile.avatar, config.appearance.background.src, config.appearance.background.poster].flatMap((value) => {
    if (!value || value.startsWith('/')) return []
    const parsed = new URL(value)
    return parsed.protocol === 'https:' ? [parsed.origin] : []
  }))]
}
