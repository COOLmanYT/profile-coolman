import assert from 'node:assert/strict'
import test from 'node:test'
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
