import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
import * as jsxRuntime from 'react/jsx-runtime'
import * as preferences from '../lib/visitor-preferences.mjs'
import { normaliseVisibility, readVisibility, writeVisibility, resetStoredPreferences, VISIBILITY_KEY, MEDIA_KEY } from '../lib/visitor-preferences.mjs'
import { COMMUNITY_CONTROLS } from '../lib/community-controls.mjs'
import { DEFAULT_TOGGLES } from '../lib/toggle-defaults.mjs'

function storage(initial = []) {
  const values = new Map(initial)
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

test('module and feature choices survive reloading without dropping either group', () => {
  const saved = storage()
  const preferences = { hiddenModules: ['steam', 'discord'], hiddenFeatures: ['roblox_followers', 'buymeacoffee_cover', 'spotify_history'] }
  writeVisibility(saved, preferences)
  assert.deepEqual(readVisibility(saved), preferences)
  writeVisibility(saved, { ...readVisibility(saved), hiddenModules: [] })
  assert.deepEqual(readVisibility(saved), { ...preferences, hiddenModules: [] })
})

test('corrupt storage, unknown feature names and duplicate entries cannot break preferences', () => {
  assert.deepEqual(readVisibility(storage([[VISIBILITY_KEY, '{invalid']])), { hiddenModules: [], hiddenFeatures: [] })
  assert.deepEqual(normaliseVisibility({ hiddenModules: ['steam', 'steam', '__proto__'], hiddenFeatures: ['steam_hours', 'not-real', null] }), { hiddenModules: ['steam'], hiddenFeatures: ['steam_hours'] })
  assert.deepEqual(readVisibility({ getItem: () => { throw new Error('blocked') } }), { hiddenModules: [], hiddenFeatures: [] })
  assert.doesNotThrow(() => writeVisibility({ setItem: () => { throw new Error('full') } }, {}))
})

test('reset clears profile preferences while preserving likes, authentication and unrelated storage', () => {
  const local = storage([[VISIBILITY_KEY, '{}'], [MEDIA_KEY, '{}'], ['coolman-legal-simple-mode', 'false'], ['coolman-seasonal-preference', '{}'], ['profile-like-browser', 'KEEP'], ['auth', 'KEEP']])
  const session = storage([['coolman-seasonal-once', 'christmas'], ['other-tab-state', 'KEEP']])
  resetStoredPreferences(local, session)
  assert.deepEqual([...local.values], [['profile-like-browser', 'KEEP'], ['auth', 'KEEP']])
  assert.deepEqual([...session.values], [['other-tab-state', 'KEEP']])
})

test('every community element control has an independent default and can be saved as hidden', () => {
  for (const { features } of COMMUNITY_CONTROLS) for (const [key] of features) {
    assert.equal(DEFAULT_TOGGLES[key], key !== 'buymeacoffee_bio', key)
    assert.deepEqual(normaliseVisibility({ hiddenFeatures: [key] }).hiddenFeatures, [key])
  }
})

test('visibility from the existing site survives the storage-key transition and reset removes both keys', () => {
  const local = storage([['coolman-module-visibility-v1', JSON.stringify({ hiddenModules: ['github'], hiddenFeatures: ['twitch_takeover'] })]])
  assert.deepEqual(readVisibility(local), { hiddenModules: ['github'], hiddenFeatures: ['twitch_takeover'] })
  writeVisibility(local, { hiddenModules: ['steam'], hiddenFeatures: ['steam_hours'] })
  assert.deepEqual(readVisibility(local), { hiddenModules: ['steam'], hiddenFeatures: ['steam_hours'] })
  resetStoredPreferences(local, storage())
  assert.deepEqual(readVisibility(local), { hiddenModules: [], hiddenFeatures: [] })
})


function mount(storage) {
  const states = [], refs = [], effects = []
  let stateIndex = 0, refIndex = 0
  const { default: Provider } = loadTypescript('components/VisitorPreferencesProvider.tsx', {
    '@/lib/visitor-preferences.mjs': preferences,
    react: {
      createContext: () => ({ Provider: 'context' }),
      useContext: () => null,
      useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = next }] },
      useRef: initial => { const i = refIndex++; return refs[i] ??= { current: initial } },
      useEffect: effect => { effects.push(effect) },
    },
    'react/jsx-runtime': jsxRuntime,
  })
  const render = () => { stateIndex = 0; refIndex = 0; return Provider({ children: null }).props.value }
  const previous = globalThis.localStorage
  globalThis.localStorage = storage
  render()
  effects[0]()
  return { render, cleanup: () => { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous } }
}

test('module and feature visibility survive fresh mounts, including rapid edits and showing again', () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  let app = mount(storage)
  try {
    const options = app.render()
    assert.equal(options.visibilityLoaded, true)
    options.setModuleHidden('github', true)
    options.setFeatureHidden('github_graph', true)
    options.setFeatureHidden('github_status', true)
    assert.equal(data.size, 1)
  } finally { app.cleanup() }
  app = mount(storage)
  try {
    const options = app.render()
    assert.deepEqual(options.hiddenModules, ['github'])
    assert.deepEqual([...options.hiddenFeatures].sort(), ['github_graph', 'github_status'])
    options.setModuleHidden('github', false)
    options.setFeatureHidden('github_graph', false)
    assert.deepEqual(app.render().hiddenFeatures, ['github_status'])
  } finally { app.cleanup() }
  app = mount(storage)
  try { assert.deepEqual(app.render().hiddenModules, []); assert.deepEqual(app.render().hiddenFeatures, ['github_status']) } finally { app.cleanup() }
})

test('visibility ignores malformed or unknown values and works when storage is blocked', () => {
  for (const raw of ['not json', 'null', '{"hiddenModules":["github","unknown",1,"github"],"hiddenFeatures":"github_graph"}']) {
    let writes = 0
    const app = mount({ getItem: () => raw, setItem: () => { writes++ } })
    try {
      assert.deepEqual(app.render().hiddenModules, raw.startsWith('{') ? ['github'] : [])
      assert.deepEqual(app.render().hiddenFeatures, [])
      assert.equal(writes, 0, 'mount never overwrites stored preferences')
    } finally { app.cleanup() }
  }
  const app = mount({ getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } })
  try {
    app.render().setModuleHidden('spotify', true)
    app.render().setFeatureHidden('discord_status', true)
    assert.deepEqual(app.render().hiddenModules, ['spotify'])
    assert.deepEqual(app.render().hiddenFeatures, ['discord_status'])
  } finally { app.cleanup() }
})

test('reset clears rapid visibility edits before subsequent edits are saved', () => {
  const local = storage()
  const previousSession = globalThis.sessionStorage
  globalThis.sessionStorage = storage()
  const app = mount(local)
  try {
    const options = app.render()
    options.setModuleHidden('steam', true)
    options.setFeatureHidden('github_graph', true)
    options.resetPreferences()
    options.setFeatureHidden('roblox_followers', true)
    assert.deepEqual(readVisibility(local), { hiddenModules: [], hiddenFeatures: ['roblox_followers'] })
  } finally {
    app.cleanup()
    if (previousSession === undefined) delete globalThis.sessionStorage
    else globalThis.sessionStorage = previousSession
  }
})
