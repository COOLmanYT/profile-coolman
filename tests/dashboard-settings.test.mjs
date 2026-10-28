import assert from 'node:assert/strict'
import test from 'node:test'
import * as react from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { siteConfig } from '../lib/site-config.mjs'
import { normaliseLayout, validLayout, featureOrderGroups, reorderFeatures } from '../lib/layout-order.mjs'
import { readAnnouncement } from '../lib/live-announcement.mjs'
import { normaliseSeasonalSettings, resolveGlobalTheme } from '../lib/seasonal.ts'
import { validateSiteConfig } from '../lib/config-validation.mjs'
import * as controls from '../lib/dashboard-controls.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

const { createElement: h } = react
const featureLayout = () => loadTypescript('components/FeatureLayout.tsx', { react, 'react/jsx-runtime': jsxRuntime })
const request = body => ({ json: async () => body })

test('layout preserves requested order, appends new modules and strips unavailable features', () => {
  const config = structuredClone(siteConfig)
  config.modules.github.features.graph.enabled = false
  config.modules.spotify.enabled = false
  config.modules.weather = { enabled: true, features: { temperature: { enabled: true } } }
  const result = normaliseLayout({ moduleOrder: ['socials', 'github', 'spotify', 'socials', 'unknown'], featureOrder: { github: ['github_graph', 'github_projects'] } }, config)
  assert.deepEqual(result.moduleOrder.slice(0, 2), ['socials', 'github'])
  assert.ok(result.moduleOrder.includes('weather'))
  assert.ok(!result.moduleOrder.includes('spotify'))
  assert.equal(result.featureOrder.github[0], 'github_projects')
  assert.ok(!result.featureOrder.github.includes('github_graph'))
  assert.deepEqual(result.featureOrder.spotify, [])
  assert.equal(validLayout(normaliseLayout(null)), true)
  for (const value of [null, { moduleOrder: ['github', 'github'], featureOrder: {} }, { moduleOrder: ['unknown'], featureOrder: {} }, { moduleOrder: [], featureOrder: { github: ['spotify_history'] } }]) assert.equal(validLayout(value), false)
})

test('feature layout reorders nested fragments and stats without moving fixed headings', () => {
  const { default: Layout, LayoutOrderProvider, FeatureSlot } = featureLayout()
  const slot = (id, text) => h(FeatureSlot, { 'data-feature': id, key: id }, h('p', null, text))
  const html = renderToStaticMarkup(h(LayoutOrderProvider, { layout: { moduleOrder: [], featureOrder: { github: ['github_projects', 'github_stats', 'github_profile', 'github_commits'] } } },
    h(Layout, { module: 'github' }, h('section', null, h('h2', null, 'Fixed heading'), slot('github_profile', 'Profile first originally'), h(react.Fragment, null, slot('github_projects', 'Projects moved up'), h('div', { 'data-feature': 'github_stats' }, slot('github_commits', 'Commits last'), slot('github_stats', 'Stars first')))))))
  assert.ok(html.indexOf('Fixed heading') < html.indexOf('Projects moved up'))
  assert.ok(html.indexOf('Projects moved up') < html.indexOf('Profile first originally'))
  assert.ok(html.indexOf('Stars first') < html.indexOf('Commits last'))
})

function accessFixture(config = structuredClone(siteConfig)) {
  let members = [], reads = 0
  const access = loadTypescript('lib/dashboard-access.ts', {
    './site-config.mjs': { siteConfig: config },
    './dashboard-settings': { readDashboardSetting: async () => { reads++; return members } },
  })
  return { access, config, setMembers: value => { members = value }, reads: () => reads }
}

test('existing Discord owner and legacy session retain access without a database', async () => {
  const previous = process.env.DISCORD_USER_ID
  process.env.DISCORD_USER_ID = 'existing-owner'
  try {
    const { access, reads } = accessFixture()
    assert.equal((await access.dashboardAccess({ user: { id: 'existing-owner' } })).owner, true)
    assert.equal((await access.dashboardAccess({ user: { provider: 'discord', id: 'existing-owner' } })).owner, true)
    assert.equal(reads(), 0)
    assert.equal(await access.dashboardAccess({ user: { id: 'stranger' } }), null)
    assert.equal(await access.dashboardAccess(null), null)
    assert.equal(await access.dashboardIdentity('github', 'existing-owner'), null)
  } finally {
    if (previous === undefined) delete process.env.DISCORD_USER_ID
    else process.env.DISCORD_USER_ID = previous
  }
})

test('editor access is provider scoped, revoked on the next request and fails closed', async () => {
  const fixture = accessFixture()
  fixture.config.dashboard.features.accessManagement = true
  fixture.setMembers([{ provider: 'discord', subject: 'editor-id' }])
  assert.equal((await fixture.access.dashboardAccess({ user: { provider: 'discord', id: 'editor-id' } })).owner, false)
  assert.equal(await fixture.access.dashboardIdentity('google', 'editor-id'), null)
  fixture.setMembers([])
  assert.equal(await fixture.access.dashboardAccess({ user: { id: 'editor-id' } }), null)
  fixture.setMembers(undefined)
  assert.equal(await fixture.access.dashboardAccess({ user: { id: 'editor-id' } }), null)
  assert.equal(fixture.access.validMembers([{ provider: 'discord', subject: 'a@example.test' }]), false)
  assert.equal(fixture.access.validMembers([{ provider: 'discord', subject: 'x' }, { provider: 'discord', subject: 'x' }]), false)
  fixture.config.dashboard.features.accessManagement = false
  fixture.setMembers([{ provider: 'discord', subject: 'editor-id' }])
  assert.equal(await fixture.access.dashboardIdentity('discord', 'editor-id'), null)
})

test('optional providers use server credentials and the legacy Discord OAuth/session path is unchanged', async () => {
  const envKeys = ['DISCORD_USER_ID', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'AUTH_GITHUB_CLIENT_ID', 'AUTH_GITHUB_CLIENT_SECRET', 'AUTH_GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_CLIENT_SECRET']
  const previous = envKeys.map(key => process.env[key])
  Object.assign(process.env, { DISCORD_USER_ID: 'discord-owner', DISCORD_CLIENT_ID: 'same-client', DISCORD_CLIENT_SECRET: 'same-secret', AUTH_GITHUB_CLIENT_ID: 'fork-client', AUTH_GITHUB_CLIENT_SECRET: 'fork-secret' })
  try {
    const fixture = accessFixture()
    const provider = id => ({ default: options => ({ id, name: id, options }) })
    const auth = () => loadTypescript('lib/auth.ts', {
      './dashboard-access': fixture.access,
      'next-auth/providers/discord': provider('discord'), 'next-auth/providers/github': provider('github'), 'next-auth/providers/google': provider('google'),
    }).authOptions
    const current = auth()
    assert.deepEqual(current.providers.map(item => item.id), ['discord'])
    assert.deepEqual(current.providers[0].options, { clientId: 'same-client', clientSecret: 'same-secret' })
    assert.equal(await current.callbacks.signIn({ account: { provider: 'discord', providerAccountId: 'discord-owner' } }), true)
    assert.equal(await current.callbacks.signIn({ account: { provider: 'discord', providerAccountId: 'stranger' } }), false)
    const legacy = await current.callbacks.session({ session: { user: {} }, token: { sub: 'discord-owner' } })
    assert.equal((await fixture.access.dashboardAccess(legacy)).owner, true)
    fixture.config.dashboard.auth.providers.github = true
    fixture.config.dashboard.auth.providers.google = true
    delete process.env.AUTH_GOOGLE_CLIENT_ID
    delete process.env.AUTH_GOOGLE_CLIENT_SECRET
    assert.deepEqual(auth().providers.map(item => item.id), ['discord', 'github'])
    const token = await auth().callbacks.jwt({ token: { sub: 'unrelated' }, account: { provider: 'github', providerAccountId: '123456' } })
    assert.deepEqual((await auth().callbacks.session({ session: { user: {} }, token })).user, { provider: 'github', id: '123456' })
  } finally { envKeys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index] }) }
})

function settingsRoute({ access = { owner: true }, saved = true, config = siteConfig } = {}) {
  const writes = [], invalidations = []
  const route = loadTypescript('app/api/dashboard/settings/route.ts', {
    'next/server': nextServer, 'next-auth': { getServerSession: async () => ({}) }, '@/lib/auth': { authOptions: {} },
    '@/lib/dashboard-access': { dashboardAccess: async () => access },
    '@/lib/site-config.mjs': { siteConfig: config, isModuleAvailable: id => config.modules[id]?.enabled === true },
    '@/lib/layout-order.mjs': { normaliseLayout, validLayout }, '@/lib/live-announcement.mjs': { readAnnouncement },
    '@/lib/dashboard-settings': { writeDashboardSetting: async (...args) => { writes.push(args); return saved } },
    'next/cache': { revalidatePath: path => invalidations.push(path) },
  })
  return { ...route, writes, invalidations }
}

test('layout/announcement saves persist before invalidation and failed writes never report success', async () => {
  for (const body of [{ type: 'layout', value: normaliseLayout({ moduleOrder: ['socials', 'profile'] }) }, { type: 'announcement', value: { message: 'New post <hello>', url: 'https://example.test/post' } }, { type: 'announcement', value: { message: '', url: '' } }]) {
    for (const saved of [true, false]) {
      const route = settingsRoute({ saved })
      const result = await route.POST(request(body))
      assert.equal(result.status, saved ? 200 : 503)
      assert.equal(route.writes.length, 1)
      assert.deepEqual(route.invalidations, saved ? ['/', '/dashboard'] : [])
    }
  }
})

test('settings reject unavailable controls, unsafe announcements and unauthorized writes', async () => {
  const route = settingsRoute()
  for (const body of [null, { type: 'layout', value: { moduleOrder: ['github', 'github'], featureOrder: {} } }, ...['javascript:alert(1)', 'https://user:pass@example.test', 'http://example.test'].map(url => ({ type: 'announcement', value: { message: 'Hi', url } })), { type: 'announcement', value: { message: 'x'.repeat(281), url: '' } }]) assert.equal((await route.POST(request(body))).status, 400)
  assert.deepEqual(route.writes, [])
  assert.equal((await settingsRoute({ access: null }).POST(request({ type: 'layout', value: normaliseLayout(null) }))).status, 401)
  const config = structuredClone(siteConfig)
  config.dashboard.features.ordering = false
  config.dashboard.features.announcements = false
  for (const type of ['layout', 'announcement']) assert.equal((await settingsRoute({ config }).POST(request({ type, value: {} }))).status, 404)
  config.dashboard.features.announcements = true
  config.announcement.source = 'lanyard'
  assert.equal((await settingsRoute({ config }).POST(request({ type: 'announcement', value: { message: 'Hello', url: '' } }))).status, 404)
})

test('announcement presentation persists through the route with strict option validation', async () => {
  const value = { message: 'New video', url: 'https://example.test/watch', label: ' Latest news ', linkText: ' Watch now ', placement: 'bar' }
  const route = settingsRoute()
  const response = await route.POST(request({ type: 'announcement', value }))
  assert.equal(response.status, 200)
  assert.deepEqual(route.writes, [['profile-announcement', { ...value, label: 'Latest news', linkText: 'Watch now' }]])
  for (const invalid of [{ label: 123 }, { label: null }, { label: 'x'.repeat(81) }, { linkText: {} }, { linkText: 'x'.repeat(81) }, { placement: null }, { placement: 'fixed' }]) {
    const rejected = settingsRoute()
    assert.equal((await rejected.POST(request({ type: 'announcement', value: { ...value, ...invalid } }))).status, 400)
    assert.deepEqual(rejected.writes, [])
  }
})

test('announcement source fallback and clear overrides are distinct', async () => {
  const config = structuredClone(siteConfig)
  let saved
  const load = () => loadTypescript('lib/dashboard-settings.ts', {
    './supabase-server': { getSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: saved === undefined ? null : { value: saved }, error: null }) }) }) }) }) },
    './site-config.mjs': { siteConfig: config }, './layout-order.mjs': { normaliseLayout }, './live-announcement.mjs': { readAnnouncement },
  })
  assert.equal(await load().getManagedAnnouncement(), undefined)
  saved = { message: 'Saved update', url: 'https://example.test' }
  assert.equal((await load().getManagedAnnouncement()).message, 'Saved update')
  assert.equal((await load().getManagedAnnouncement()).label, 'A little update')
  assert.equal((await load().getManagedAnnouncement()).placement, 'card')
  saved = { ...saved, label: 'News', linkText: 'Read this', placement: 'bar' }
  assert.deepEqual(await load().getManagedAnnouncement(), { ...saved, url: 'https://example.test/' })
  saved = { message: '', url: '' }
  assert.equal(await load().getManagedAnnouncement(), null)
  config.announcement.source = 'lanyard'
  assert.equal(await load().getManagedAnnouncement(), undefined)
  config.announcement.source = 'dashboard'
  saved = undefined
  assert.equal(await load().getManagedAnnouncement(), null)
  config.announcement.message = 'JSON default'
  assert.equal((await load().getManagedAnnouncement()).message, 'JSON default')
  config.announcement.label = 'Configured label'
  config.announcement.linkText = 'Configured link'
  config.announcement.placement = 'bar'
  assert.equal((await load().getManagedAnnouncement()).label, 'Configured label')
  assert.equal((await load().getManagedAnnouncement()).linkText, 'Configured link')
  assert.equal((await load().getManagedAnnouncement()).placement, 'bar')
})

test('only permanent owners can edit private membership and disabled access management rejects writes', async () => {
  for (const [enabled, access, expected] of [[false, { owner: true }, 404], [true, null, 403], [true, { owner: false }, 403], [true, { owner: true }, 200]]) {
    const config = structuredClone(siteConfig); config.dashboard.features.accessManagement = enabled
    const writes = [], invalidations = []
    const { POST } = loadTypescript('app/api/dashboard/access/route.ts', {
      'next/server': nextServer, 'next-auth': { getServerSession: async () => ({}) }, '@/lib/auth': { authOptions: {} },
      '@/lib/site-config.mjs': { siteConfig: config }, '@/lib/dashboard-access': { dashboardAccess: async () => access, validMembers: accessFixture().access.validMembers },
      '@/lib/dashboard-settings': { writeDashboardSetting: async (...args) => { writes.push(args); return true } },
      'next/cache': { revalidatePath: path => invalidations.push(path) },
    })
    assert.equal((await POST(request([{ provider: 'discord', subject: 'new-editor', ignored: 'not stored' }]))).status, expected)
    assert.equal(writes.length, expected === 200 ? 1 : 0)
    if (expected === 200) assert.deepEqual(writes[0], ['dashboard-access', [{ provider: 'discord', subject: 'new-editor' }]])
    assert.deepEqual(invalidations, expected === 200 ? ['/dashboard'] : [])
  }
})

test('disabled seasonal events cannot run through automatic dates or a saved schedule', () => {
  const settings = normaliseSeasonalSettings({ enabledThemes: ['christmas', 'unknown', 'christmas'], automaticEnabled: true, scheduledTheme: 'halloween', scheduledStartsAt: '2026-10-01T00:00:00Z', scheduledEndsAt: '2026-11-02T00:00:00Z' })
  assert.deepEqual(settings.enabledThemes, ['christmas'])
  assert.equal(resolveGlobalTheme(settings, new Date('2026-10-31T12:00:00Z'), 'UTC'), null)
  assert.equal(resolveGlobalTheme(settings, new Date('2026-12-25T12:00:00Z'), 'UTC'), 'christmas')
})

test('JSON seasonal availability overrides stale saved values and personal choices', () => {
  const config = structuredClone(siteConfig)
  config.seasonal.availableThemes.halloween = false
  assert.doesNotThrow(() => validateSiteConfig(config))
  const seasonal = loadTypescript('lib/seasonal.ts', { './site-config.mjs': { siteConfig: config } })
  const settings = { ...seasonal.DEFAULT_SEASONAL_SETTINGS, enabledThemes: ['halloween'] }
  assert.ok(!seasonal.SEASONAL_THEMES.includes('halloween'))
  assert.equal(seasonal.isSeasonalTheme('halloween'), false)
  assert.deepEqual(seasonal.normaliseSeasonalSettings(settings).enabledThemes, [])
  assert.equal(seasonal.resolveGlobalTheme(settings, new Date('2026-10-31T12:00:00Z'), 'UTC'), null)
})

test('seasonal defaults can be explicitly cleared and disabled events lose their old schedule', () => {
  const config = structuredClone(siteConfig)
  Object.assign(config.seasonal.defaults, { scheduledTheme: 'halloween', scheduledStartsAt: '2026-10-01T00:00:00Z', scheduledEndsAt: '2026-11-01T00:00:00Z' })
  const seasonal = loadTypescript('lib/seasonal.ts', { './site-config.mjs': { siteConfig: config } })
  assert.equal(seasonal.normaliseSeasonalSettings({}).scheduledStartsAt, config.seasonal.defaults.scheduledStartsAt)
  const cleared = seasonal.normaliseSeasonalSettings({ scheduledTheme: null, scheduledStartsAt: null, scheduledEndsAt: null })
  assert.equal(cleared.scheduledTheme, null)
  assert.equal(cleared.scheduledStartsAt, null)
  assert.equal(cleared.scheduledEndsAt, null)
  assert.equal(seasonal.normaliseSeasonalSettings({ enabledThemes: [], scheduledTheme: 'halloween' }).scheduledTheme, null)
})

test('dashboard persistence handles missing storage, errors and missing write receipts', async () => {
  for (const response of [null, { error: null, data: { value: { message: 'Saved' } } }, { error: null, data: null }, { error: { message: 'offline' }, data: null }, 'throw']) {
    const client = loadTypescript('lib/dashboard-settings.ts', {
      './supabase-server': { getSupabase: () => response === null ? null : ({ from: () => ({ upsert: () => ({ select: () => ({ single: async () => { if (response === 'throw') throw new Error('offline'); return response } }) }) }) }) },
      './layout-order.mjs': { normaliseLayout }, './live-announcement.mjs': { readAnnouncement },
    })
    assert.equal(await client.writeDashboardSetting('profile-announcement', { message: 'Saved' }), !!response?.data?.value)
  }
})

test('real community statistics and header details follow the saved feature order', () => {
  const features = featureLayout()
  let index = 0
  const Header = loadTypescript('components/ModuleHeader.tsx', { 'react/jsx-runtime': jsxRuntime, './FeatureLayout': features, 'next/image': { default: () => null } }).default
  const Widget = loadTypescript('components/CommunityWidget.tsx', {
    'react/jsx-runtime': jsxRuntime, './FeatureLayout': features, './ModuleHeader': { default: Header },
    react: { useEffect: () => {}, useState: () => [index++ === 0 ? { name: 'Display name', username: 'handle-last', stats: [{ label: 'Friends', value: 1 }, { label: 'Followers', value: 2 }, { label: 'Following', value: 3 }] } : false, () => {}] },
    '@/lib/community-profiles.mjs': { COMMUNITY_LINKS: { roblox: 'https://example.test' } },
    '@/lib/widget-polling.mjs': { startPolling: () => () => {}, fetchWidgetJson: () => {} },
  }).default
  const order = ['roblox_username', 'roblox_name', 'roblox_following', 'roblox_friends', 'roblox_followers']
  const html = renderToStaticMarkup(h(features.LayoutOrderProvider, { layout: { moduleOrder: ['roblox'], featureOrder: { roblox: order } } }, h(Widget, { service: 'roblox', visible: Object.fromEntries([...order, 'roblox_stats'].map(id => [id, true])) })))
  assert.ok(html.indexOf('handle-last') < html.indexOf('Display name'))
  assert.ok(html.indexOf('Following') < html.indexOf('Friends'))
  assert.ok(html.indexOf('Friends') < html.indexOf('Followers'))
})

test('Twitch schedule and calendar action move together without nesting a button in a link', () => {
  const features = featureLayout()
  const Widget = loadTypescript('components/TwitchWidget.tsx', { react, 'react/jsx-runtime': jsxRuntime, './FeatureLayout': features, 'next/image': { default: () => null } }).default
  const html = renderToStaticMarkup(h(features.LayoutOrderProvider, { layout: { moduleOrder: ['twitch'], featureOrder: { twitch: ['twitch_schedule', 'twitch_stats', 'twitch_profile'] } } }, h(Widget, { state: { loaded: true, isUnavailable: false, presence: { channelName: 'Channel profile', isLive: false, nextStream: { title: 'Scheduled event', startsAt: '2026-11-01T12:00:00Z' } } } })))
  assert.ok(html.indexOf('Scheduled event') < html.indexOf('Add to calendar'))
  assert.ok(html.indexOf('Add to calendar') < html.indexOf('Followers'))
  assert.ok(html.indexOf('Followers') < html.indexOf('Channel profile'))
  assert.ok(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button/.test(html))
})

test('dashboard ordering buttons update the preview and save the new module and feature order', async () => {
  const state = [], previews = [], requests = []
  let cursor = 0
  const Component = loadTypescript('components/LayoutSettingsClient.tsx', {
    'react/jsx-runtime': jsxRuntime,
    react: { useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }] } },
    '@/lib/dashboard-controls.mjs': controls, './ToastProvider': { useToast: () => ({ showToast() {} }) },
  }).default
  const render = () => { cursor = 0; return Component({ initialLayout: normaliseLayout(null), onChange: value => previews.push(value) }) }
  const find = (node, predicate) => {
    if (Array.isArray(node)) return node.map(item => find(item, predicate)).find(Boolean)
    if (!react.isValidElement(node)) return null
    return predicate(node) ? node : find(node.props.children, predicate)
  }
  const button = label => find(render(), node => node.type === 'button' && node.props['aria-label'] === label)
  button('Move GitHub up').props.onClick()
  button('Move Contribution graph up').props.onClick()
  assert.equal(previews.at(-1).moduleOrder[1], 'github')
  assert.ok(previews.at(-1).featureOrder.github.indexOf('github_graph') < previews.at(-1).featureOrder.github.indexOf('github_stats'))
  assert.ok(previews.at(-1).featureOrder.github.indexOf('github_stats') < previews.at(-1).featureOrder.github.indexOf('github_commits'), 'Moving a section must preserve the separate statistics order')
  const previous = globalThis.fetch
  globalThis.fetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true } }
  try {
    await find(render(), node => node.type === 'button' && node.props.children === 'Save order').props.onClick()
    assert.deepEqual(requests, [{ url: '/api/dashboard/settings', body: { type: 'layout', value: previews.at(-1) } }])
  } finally { globalThis.fetch = previous }
})

test('section and statistic ordering remain independent in both directions', () => {
  const order = normaliseLayout(null).featureOrder.github
  const groups = Object.values(featureOrderGroups('github', order)).map(parts => parts.map(part => `github_${part}`))
  for (const changed of groups) {
    const current = order.filter(key => changed.includes(key))
    const updated = reorderFeatures(order, [...current].reverse(), groups)
    assert.deepEqual(updated.filter(key => changed.includes(key)), [...current].reverse())
    for (const other of groups.filter(group => group !== changed)) assert.deepEqual(updated.filter(key => other.includes(key)), order.filter(key => other.includes(key)))
    assert.deepEqual([...updated].sort(), [...order].sort())
  }
})

test('commit-only GitHub statistics keep an orderable section when star totals are code-disabled', () => {
  const config = structuredClone(siteConfig)
  config.modules.github.features.stats.enabled = false
  const layout = normaliseLayout({ featureOrder: { github: ['github_commits', 'github_graph'] } }, config)
  assert.ok(featureOrderGroups('github', layout.featureOrder.github).Sections.includes('commits'))
  const features = featureLayout()
  let index = 0
  const Widget = loadTypescript('components/GithubWidget.tsx', {
    'react/jsx-runtime': jsxRuntime, './FeatureLayout': features,
    react: { useEffect: () => {}, useState: () => [index++ === 0 ? { status: null, commitsPastYear: 12, commitsUrl: 'https://github.com/search', calendar: null, projects: [] } : false, () => {}] },
    '@/lib/site-config.mjs': { siteConfig: config, providerLinks: { github: 'https://github.com/example' }, isControlAvailable: key => key !== 'github_stats' },
    '@/lib/widget-polling.mjs': { startPolling: () => () => {}, fetchWidgetJson: () => {} },
  }).default
  const html = renderToStaticMarkup(h(features.LayoutOrderProvider, { layout }, h(Widget, { showStats: false, showProfile: false, showProjects: false })))
  assert.ok(html.includes('Commits · past year'))
  assert.ok(html.indexOf('Commits · past year') < html.indexOf('Graph unavailable'))
})

test('visitor options reflect restored seasonal preferences and stop offering a disabled selection', () => {
  const state = []
  let cursor = 0, preference = { theme: null, until: null }, allowedThemes = ['halloween', 'christmas']
  const Component = loadTypescript('components/SeasonalOptionsClient.tsx', {
    'react/jsx-runtime': jsxRuntime, 'next/link': { default: () => null },
    react: { useEffect() {}, useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value }] } },
    '@/lib/dashboard-controls.mjs': controls,
    './ToastProvider': { useToast: () => ({ showToast() {} }) }, './ColorModeProvider': { ColorModeControl: () => null },
    './SeasonalThemeProvider': { useSeasonalTheme: () => ({ preference, allowedThemes, timeZone: 'UTC' }) },
    './VisitorPreferencesProvider': { useVisitorPreferences: () => ({ hiddenModules: [], hiddenFeatures: [], mediaPreferences: {} }) },
    './SeasonalPreview': { default: () => null }, './SeasonalSimulationControls': { default: () => null },
  }).default
  const render = () => { cursor = 0; return Component({ legalSimpleModeDefault: false }) }
  const find = (node, predicate) => Array.isArray(node) ? node.map(item => find(item, predicate)).find(Boolean) : react.isValidElement(node) ? predicate(node) ? node : find(node.props.children, predicate) : null
  render()
  preference = { theme: 'halloween', until: '2030-10-31T12:00:00Z' }
  assert.equal(find(render(), node => node.type === 'select').props.value, 'halloween')
  const date = new Date(preference.until)
  assert.equal(find(render(), node => node.type === 'input' && node.props.type === 'datetime-local').props.value, new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
  find(render(), node => node.type === 'select').props.onChange({ target: { value: 'christmas' } })
  assert.equal(find(render(), node => node.type === 'select').props.value, 'christmas')
  allowedThemes = ['halloween']
  assert.equal(find(render(), node => node.type === 'select').props.value, '')
  assert.equal(find(render(), node => node.type === 'button' && node.props.children === 'Save timed theme').props.disabled, true)
})

test('new JSON controls reject invalid defaults and the repository keeps Discord and fixed dark mode', () => {
  assert.deepEqual(siteConfig.dashboard.auth.providers, { discord: true, github: false, google: false })
  assert.equal(siteConfig.dashboard.features.accessManagement, false)
  assert.equal(siteConfig.appearance.defaultMode, 'dark')
  assert.equal(siteConfig.appearance.allowModeSwitch, false)
  for (const modify of [c => { c.layout.moduleOrder.push('not-a-module') }, c => { c.layout.featureOrder.github = ['github_profile', 'github_profile'] }, c => { c.dashboard.auth.providers.discord = false }, c => { c.dashboard.auth.providers = { discord: false, github: false, google: false, unsupported: true } }, c => { c.announcement.url = 'javascript:alert(1)' }, c => { c.seasonal.defaults.enabledThemes = ['unknown'] }, c => { c.seasonal.defaults.scheduledTheme = 'halloween' }, c => { c.seasonal.defaults.scheduledStartsAt = 123 }, c => { c.seasonal.defaults.scheduledEndsAt = 'invalid' }]) {
    const config = structuredClone(siteConfig); modify(config)
    assert.throws(() => validateSiteConfig(config), /site.config.json:/)
  }
})
