import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as jsxRuntime from 'react/jsx-runtime'
import * as configModule from '../lib/site-config.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'
import { readAnnouncement } from '../lib/live-announcement.mjs'

const image = ({ src, alt }) => createElement('img', { src, alt })
const snapshot = { name: 'Example owner', username: '@example', avatarUrl: '/avatar.png', coverUrl: '/cover.jpg', bio: 'Example bio', item: 'coffee', price: 5, currency: 'AUD', supporters: 42, memberships: [{ title: 'Member', price: 3, url: 'https://example.test' }], stats: [{ label: 'Friends', value: 42 }] }

test('managed and live announcements render once in their chosen placement with escaped custom text', () => {
  const announcement = readAnnouncement({ announcement: '<b>Hello</b>', announcement_url: 'https://example.test/', announcement_label: 'News <script>', announcement_link_text: 'Watch <now>', announcement_placement: 'bar' })
  const Live = loadTypescript('components/LiveAnnouncement.tsx', {
    'react/jsx-runtime': jsxRuntime, '@/lib/live-announcement.mjs': { readAnnouncement },
    '@/lib/use-lanyard': { useLanyard: () => ({ presence: { kv: { announcement: 'Live news', announcement_placement: 'bar' } }, unavailable: false }) },
  }).default
  const render = props => renderToStaticMarkup(createElement(Live, props))
  assert.equal(render({ managed: announcement }), '')
  const html = render({ managed: announcement, placement: 'bar' })
  for (const text of ['News &lt;script&gt;', 'Watch &lt;now&gt;', '&lt;b&gt;Hello&lt;/b&gt;', 'https://example.test/', 'border-b']) assert.ok(html.includes(text), text)
  assert.equal(render({ managed: null, placement: 'bar' }), '')
  assert.equal(render({}), '')
  assert.ok(render({ placement: 'bar' }).includes('Live news'))
  const card = { ...announcement, placement: 'card', label: '', url: null }
  const cardHtml = render({ managed: card })
  assert.ok(cardHtml.includes('rounded-2xl'))
  assert.ok(!cardHtml.includes('<a '))
  assert.ok(!cardHtml.includes('News'))
  assert.equal(render({ managed: card, placement: 'bar' }), '')
})

test('home places a bar before the profile and respects owner and visitor visibility', async () => {
  let enabled = true, hidden = false
  const announcement = readAnnouncement({ announcement: 'Page announcement', announcement_placement: 'bar' })
  const dependencies = {
    'react/jsx-runtime': jsxRuntime,
    '@/lib/dashboard-settings': { getLayoutSettings: async () => ({}), getManagedAnnouncement: async () => announcement },
    '@/lib/toggles': { getToggles: async () => ({ announcement: enabled }) },
    '@/lib/site-settings': { getSeasonalSettings: async () => ({}) },
    'next/link': { default: props => createElement('a', props) },
    '@/components/VisitorModule': { default: ({ children }) => hidden ? null : children },
    '@/components/LiveAnnouncement': { default: loadTypescript('components/LiveAnnouncement.tsx', { 'react/jsx-runtime': jsxRuntime, '@/lib/live-announcement.mjs': { readAnnouncement }, '@/lib/use-lanyard': { useLanyard: () => { throw new Error('Managed announcement should not subscribe') } } }).default },
    '@/components/ProfileCard': { default: () => createElement('div', {}, 'Profile card') },
    '@/components/SeasonalThemeProvider': { default: ({ children }) => children },
  }
  for (const name of ['EasterEgg', 'ViewCounter', 'AnimatedBackground', 'SeasonalEffects', 'ShareCard', 'StatusWidget', 'LikeCounter']) dependencies[`@/components/${name}`] = { default: () => null }
  const Home = loadTypescript('app/page.tsx', dependencies).default
  const html = renderToStaticMarkup(await Home())
  assert.ok(html.indexOf('Page announcement') < html.indexOf('Profile card'))
  assert.equal(html.match(/Page announcement/g).length, 1)
  hidden = true
  assert.ok(!renderToStaticMarkup(await Home()).includes('Page announcement'))
  hidden = false; enabled = false
  assert.ok(!renderToStaticMarkup(await Home()).includes('Page announcement'))
})

test('announcement editor publishes all options, restores them on reload and clears either placement', async () => {
  const previousFetch = globalThis.fetch
  const states = [], requests = [], toasts = []
  let cursor = 0, refreshed = 0
  const Editor = loadTypescript('components/AnnouncementEditor.tsx', {
    'react/jsx-runtime': jsxRuntime,
    react: { useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value }] } },
    'next/navigation': { useRouter: () => ({ refresh: () => refreshed++ }) },
    './ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
  }).default
  function render(initialAnnouncement = null) { cursor = 0; return Editor({ initialAnnouncement }) }
  function nodes(tree, type) {
    if (!tree || typeof tree !== 'object') return []
    if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type))
    return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)]
  }
  try {
    globalThis.fetch = async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true } }
    const tree = render()
    const inputs = nodes(tree, 'input')
    inputs[0].props.onChange({ target: { value: 'Latest news' } })
    nodes(tree, 'textarea')[0].props.onChange({ target: { value: 'New video' } })
    inputs[1].props.onChange({ target: { value: 'https://example.test/watch' } })
    inputs[2].props.onChange({ target: { value: 'Watch now' } })
    nodes(tree, 'select')[0].props.onChange({ target: { value: 'bar' } })
    await nodes(render(), 'button')[0].props.onClick()
    const saved = requests[0].value
    assert.deepEqual(saved, { label: 'Latest news', message: 'New video', url: 'https://example.test/watch', linkText: 'Watch now', placement: 'bar' })
    assert.equal(refreshed, 1)
    states.length = 0
    const reloaded = render(saved)
    assert.deepEqual(nodes(reloaded, 'input').map(node => node.props.value), ['Latest news', 'https://example.test/watch', 'Watch now'])
    assert.equal(nodes(reloaded, 'select')[0].props.value, 'bar')
    globalThis.fetch = async () => ({ ok: false })
    await nodes(render(), 'button')[0].props.onClick()
    assert.equal(toasts.at(-1).variant, 'error')
    assert.equal(nodes(render(), 'textarea')[0].props.value, 'New video')
    globalThis.fetch = async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true } }
    await nodes(render(), 'button')[1].props.onClick()
    assert.equal(requests.at(-1).value.message, '')
    assert.equal(requests.at(-1).value.url, '')
    assert.equal(nodes(render(), 'textarea')[0].props.value, '')
  } finally { globalThis.fetch = previousFetch }
})
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
