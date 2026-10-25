import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as jsxRuntime from 'react/jsx-runtime'
import * as configModule from '../lib/site-config.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const image = ({ src, alt }) => createElement('img', { src, alt })
const snapshot = { name: 'Example owner', username: '@example', avatarUrl: '/avatar.png', coverUrl: '/cover.jpg', bio: 'Example bio', item: 'coffee', price: 5, currency: 'AUD', supporters: 42, memberships: [{ title: 'Member', price: 3, url: 'https://example.test' }], stats: [{ label: 'Friends', value: 42 }] }
function widgetDependencies() {
  let index = 0
  const Header = loadTypescript('components/ModuleHeader.tsx', { 'react/jsx-runtime': jsxRuntime, 'next/image': { default: image } }).default
  return {
    'react/jsx-runtime': jsxRuntime, 'next/image': { default: image },
    react: { useEffect: () => {}, useState: () => [index++ === 0 ? snapshot : false, () => {}] },
    '@/lib/community-profiles.mjs': { COMMUNITY_LINKS: { roblox: 'https://example.test', buymeacoffee: 'https://example.test' } },
    '@/lib/widget-polling.mjs': { startPolling: () => () => {}, fetchWidgetJson: () => {} },
    './ModuleHeader': { default: Header },
  }
}

test('community cards fail closed for disabled or missing detail flags', () => {
  for (const [path, props] of [['components/CommunityWidget.tsx', { service: 'roblox' }], ['components/BuyMeACoffeeWidget.tsx', {}]]) {
    const Widget = loadTypescript(path, widgetDependencies()).default
    const html = renderToStaticMarkup(createElement(Widget, { ...props, visible: {} }))
    for (const text of ['Example owner', '@example', 'Example bio', 'cover.jpg', 'avatar.png', 'Friends', '42', 'Member', 'Buy me a']) assert.ok(!html.includes(text), `${path}: ${text}`)
    const prefix = props.service ?? 'buymeacoffee'
    const enabled = renderToStaticMarkup(createElement(loadTypescript(path, widgetDependencies()).default, { ...props, visible: { [`${prefix}_name`]: true } }))
    assert.ok(enabled.includes('Example owner'))
  }
})

test('profile forwards explicit false flags for code-disabled community features even in preview', () => {
  const config = structuredClone(configModule.siteConfig)
  config.modules.steam.features.hours.enabled = false
  config.modules.roblox.features.avatar.enabled = false
  const captures = {}
  const dependencies = {
    'react/jsx-runtime': jsxRuntime, react: { useEffect: () => {}, useRef: () => ({ current: null }) },
    'next/navigation': { useRouter: () => ({ push: () => {} }) },
    '@/lib/site-config.mjs': { ...configModule, siteConfig: config, applyModulePolicy: values => configModule.applyModulePolicy(values, config), isControlAvailable: key => configModule.isControlAvailable(key, config) },
    '@/lib/use-twitch-presence': { useTwitchPresence: () => ({ isUnavailable: true }) },
    './VisitorPreferencesProvider': { useVisitorPreferences: () => ({ visibilityLoaded: true, hiddenModules: [], hiddenFeatures: [], mediaPreferences: { showYoutube: true, youtubeFormat: 'both' } }) },
  }
  for (const name of ['AvatarImage', 'SpotifyWidget', 'TwitchWidget', 'DiscordWidget', 'SocialLinks', 'YouTubeWidget', 'BuyMeACoffeeWidget', 'SeasonalHat', 'GithubWidget', 'LiveAnnouncement', 'StreamTakeover']) dependencies[`./${name}`] = { default: () => null }
  dependencies['./CommunityWidget'] = { default: props => { captures[props.service] = props.visible; return null } }
  const Profile = loadTypescript('components/ProfileCard.tsx', dependencies).default
  renderToStaticMarkup(createElement(Profile, { toggles: { steam_hours: true, roblox_avatar: true }, preview: true }))
  assert.equal(captures.steam.steam_hours, false)
  assert.equal(captures.roblox.roblox_avatar, false)
  assert.equal(captures.steam.steam_name, true)
})

test('outbound tracking honours the global analytics toggle', () => {
  const events = []
  const Social = loadTypescript('components/SocialLinks.tsx', {
    'react/jsx-runtime': jsxRuntime, 'next/image': { default: image }, '@vercel/analytics': { track: (...args) => events.push(args) },
  }).default
  for (const link of Social({ analyticsEnabled: false }).props.children) link.props.onClick()
  assert.equal(events.length, 0)
  Social({ analyticsEnabled: true }).props.children[0].props.onClick()
  assert.equal(events.length, 1)
})

test('changing analytics invalidates the root layout only after a successful owner save', async () => {
  const previous = process.env.DISCORD_USER_ID
  process.env.DISCORD_USER_ID = 'owner'
  try {
    for (const error of [null, { message: 'failed' }]) {
      const invalidations = []
      const route = loadTypescript('app/api/dashboard/toggle/route.ts', {
        'next/server': nextServer, 'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) }, '@/lib/auth': { authOptions: {} },
        '@/lib/toggle-defaults.mjs': { DEFAULT_TOGGLES: configModule.configuredDefaults() },
        '@/lib/supabase-server': { getSupabase: () => ({ from: () => ({ upsert: async () => ({ error }) }) }) },
        'next/cache': { revalidatePath: (...args) => invalidations.push(args) },
      })
      assert.equal((await route.POST({ json: async () => ({ id: 'analytics', value: false }) })).status, error ? 500 : 200)
      assert.deepEqual(invalidations, error ? [] : [['/', 'layout']])
    }
  } finally {
    if (previous === undefined) delete process.env.DISCORD_USER_ID
    else process.env.DISCORD_USER_ID = previous
  }
})
