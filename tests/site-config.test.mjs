import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { siteConfig, applyModulePolicy, configuredGroups, configuredDefaults, isControlAvailable } from '../lib/site-config.mjs'
import { validateSiteConfig, configuredMediaOrigins } from '../lib/config-validation.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

test('availability overrides old saved values and removes controls while defaults remain overridable', () => {
  const config = structuredClone(siteConfig)
  config.modules.spotify.enabled = false
  config.modules.youtube.features.embed_default.enabled = false
  config.modules.github.default = false
  const toggles = applyModulePolicy({ spotify: true, spotify_history: true, youtube_embed_default: true, github: true }, config)
  assert.equal(toggles.spotify, false)
  assert.equal(toggles.spotify_history, false)
  assert.equal(toggles.youtube_embed_default, false)
  assert.equal(toggles.github, true)
  assert.equal(configuredDefaults(config).github, false)
  assert.ok(!configuredGroups(config).some(({ parentKey }) => parentKey === 'spotify'))
  assert.ok(!configuredGroups(config).flatMap(({ keys }) => keys).includes('youtube_embed_default'))
})

test('new modules automatically acquire defaults and labelled dashboard controls', () => {
  const config = structuredClone(siteConfig)
  config.modules.weather = { label: 'Weather', description: 'Local weather', enabled: true, default: false, features: { temperature: { label: 'Temperature', enabled: true, default: true } } }
  validateSiteConfig(config)
  assert.equal(isControlAvailable('weather_temperature', config), true)
  assert.deepEqual(configuredGroups(config).at(-1).keys, ['weather', 'weather_temperature'])
  assert.equal(applyModulePolicy({ weather: true }, config).weather, true)
})

test('configuration rejects executable URLs, secret fields and malformed settings with useful paths', () => {
  for (const [modify, pattern] of [
    [c => { c.profile.avatar = 'javascript:alert(1)' }, /profile.avatar/],
    [c => { c.appearance.background.src = '//evil.test/a.png' }, /background.src/],
    [c => { c.socials[0].url = 'data:text/html,hello' }, /socials\[0\].url/],
    [c => { c.providers.github.apiKey = 'do-not-publish' }, /secret field/],
    [c => { c.modules.spotify.enabled = 'false' }, /modules.spotify.enabled/],
    [c => { c.modules.spotify.features.history.default = 0 }, /history.default/],
    [c => { c.appearance.background.speed = 99 }, /background.speed/],
  ]) {
    const config = structuredClone(siteConfig); modify(config)
    assert.throws(() => validateSiteConfig(config), pattern)
  }
})

test('media policy allows exact configured HTTPS origins and every supported background type', () => {
  const config = structuredClone(siteConfig)
  config.profile.avatar = 'https://avatars.example.test/me.png'
  config.appearance.background.src = 'https://media.example.test/background.webm'
  config.appearance.background.poster = 'https://media.example.test/poster.jpg'
  for (const type of ['preset', 'color', 'image', 'gif', 'video']) {
    config.appearance.background.type = type
    assert.doesNotThrow(() => validateSiteConfig(config))
  }
  assert.deepEqual(configuredMediaOrigins(config), ['https://avatars.example.test', 'https://media.example.test'])
})

test('removed modules return a no-store 404 before provider, database or auth work', async () => {
  for (const path of ['github', 'youtube', 'twitch', 'spotify', 'discord', 'status', 'views', 'likes']) {
    const route = loadTypescript(`app/api/${path}/route.ts`, new Proxy({
      'next/server': nextServer,
      '@/lib/site-config.mjs': { siteConfig, isModuleAvailable: () => false },
    }, {
      has: () => true,
      get: (target, key) => key in target ? target[key] : new Proxy({}, { get: () => () => ({}) }),
    }))
    const response = await route.GET({ nextUrl: new URL('https://test.invalid') })
    assert.equal(response.status, 404, path)
    assert.equal(response.headers.get('Cache-Control'), 'no-store', path)
  }
})

test('dashboard cannot restore a feature excluded from configuration', async () => {
  const previous = process.env.DISCORD_USER_ID
  process.env.DISCORD_USER_ID = 'owner'
  let writes = 0
  try {
    const route = loadTypescript('app/api/dashboard/toggle/route.ts', {
      'next/server': nextServer, 'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) }, '@/lib/auth': { authOptions: {} },
      '@/lib/site-config.mjs': { isControlAvailable: () => false },
      '@/lib/toggle-defaults.mjs': { DEFAULT_TOGGLES: { spotify_history: false } },
      '@/lib/supabase-server': { getSupabase: () => { writes++; throw new Error('must not write') } },
      'next/cache': { revalidatePath: () => assert.fail('must not revalidate') },
    })
    assert.equal((await route.POST({ json: async () => ({ id: 'spotify_history', value: true }) })).status, 400)
    assert.equal(writes, 0)
  } finally {
    if (previous === undefined) delete process.env.DISCORD_USER_ID
    else process.env.DISCORD_USER_ID = previous
  }
})

test('a fork fetches and verifies its own Roblox, Steam and Coffee identities', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'profile-config-'))
  mkdirSync(join(directory, 'lib'))
  const config = structuredClone(siteConfig)
  config.providers.roblox.userId = '12345'
  config.providers.steam.id = '76561198000000000'
  config.providers.steam.username = 'fork-user'
  config.providers.buymeacoffee.slug = 'fork-creator'
  writeFileSync(join(directory, 'site.config.json'), JSON.stringify(config))
  for (const file of ['site-config.mjs', 'config-validation.mjs', 'community-profiles.mjs']) copyFileSync(new URL(`../lib/${file}`, import.meta.url), join(directory, 'lib', file))
  try {
    const community = await import(pathToFileURL(join(directory, 'lib/community-profiles.mjs')).href)
    const calls = []
    const roblox = await community.fetchCommunityProfile('roblox', async (url) => {
      calls.push(url)
      return Response.json(url.includes('users.roblox.com') ? { id: 12345, name: 'ForkUser' } : {})
    })
    assert.equal(roblox.username, '@ForkUser')
    assert.ok(calls.every(url => url.includes('12345')))
    assert.equal(community.parseSteamProfile('<profile><steamID64>76561198000000000</steamID64><steamID>Fork User</steamID></profile>').username, 'fork-user')
    assert.throws(() => community.parseSteamProfile('<profile><steamID64>76561198765816074</steamID64><steamID>Wrong user</steamID></profile>'))
    const coffee = community.parseCoffeeProfile(`<script data-page="app" type="application/json">${JSON.stringify({ props: { creator_data: { data: { slug: 'fork-creator', name: 'Fork User' } } } })}</script>`)
    assert.equal(coffee.name, 'Fork User')
    assert.equal(community.COMMUNITY_LINKS.buymeacoffee, 'https://buymeacoffee.com/fork-creator')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
