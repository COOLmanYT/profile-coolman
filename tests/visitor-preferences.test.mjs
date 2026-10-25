import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
import * as jsxRuntime from 'react/jsx-runtime'

function mount(storage) {
  const states = [], refs = [], effects = []
  let stateIndex = 0, refIndex = 0
  const { default: Provider } = loadTypescript('components/VisitorPreferencesProvider.tsx', {
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
    assert.deepEqual(options.hiddenFeatures, ['github_status', 'github_graph'])
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
