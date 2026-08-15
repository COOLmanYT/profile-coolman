import assert from 'node:assert/strict'
import test from 'node:test'
import { getTwitchConfig, getTwitchRedirectUri } from '../lib/twitch.ts'

// These functions read process.env, so each test snapshots and restores the
// relevant variables to stay isolated from one another.
const ENV_KEYS = ['TWITCH_REDIRECT_URI', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET']

function withTwitchEnv(overrides, run) {
  const saved = {}
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve().then(run).finally(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })
}

test('getTwitchRedirectUri falls back to the request origin when no URI is configured', () =>
  withTwitchEnv({}, () => {
    assert.equal(
      getTwitchRedirectUri('https://profile.example.com'),
      'https://profile.example.com/api/twitch/callback',
    )
  }))

test('getTwitchRedirectUri uses a configured https redirect URI verbatim', () =>
  withTwitchEnv(
    { TWITCH_REDIRECT_URI: 'https://profile.example.com/api/twitch/callback' },
    () => {
      assert.equal(
        getTwitchRedirectUri('https://other.example.com'),
        'https://profile.example.com/api/twitch/callback',
      )
    },
  ))

test('getTwitchRedirectUri allows http only for localhost', () =>
  withTwitchEnv({ TWITCH_REDIRECT_URI: 'http://localhost:3000/api/twitch/callback' }, () => {
    assert.equal(
      getTwitchRedirectUri('https://other.example.com'),
      'http://localhost:3000/api/twitch/callback',
    )
  }))

test('getTwitchRedirectUri rejects an http URI that is not localhost and falls back to the origin', () =>
  withTwitchEnv({ TWITCH_REDIRECT_URI: 'http://evil.example.com/api/twitch/callback' }, () => {
    assert.equal(
      getTwitchRedirectUri('https://fallback.example.com'),
      'https://fallback.example.com/api/twitch/callback',
    )
  }))

test('getTwitchRedirectUri falls back to the origin when the configured value is not a URL', () =>
  withTwitchEnv({ TWITCH_REDIRECT_URI: 'not-a-valid-url' }, () => {
    assert.equal(
      getTwitchRedirectUri('https://fallback.example.com'),
      'https://fallback.example.com/api/twitch/callback',
    )
  }))

test('getTwitchConfig returns null when credentials are missing', () =>
  withTwitchEnv({}, () => {
    assert.equal(getTwitchConfig(), null)
  }))

test('getTwitchConfig returns null when credentials are placeholders', () =>
  withTwitchEnv({ TWITCH_CLIENT_ID: 'placeholder', TWITCH_CLIENT_SECRET: 'placeholder' }, () => {
    assert.equal(getTwitchConfig(), null)
  }))

test('getTwitchConfig returns the configured credentials when both are present', () =>
  withTwitchEnv({ TWITCH_CLIENT_ID: 'client-id', TWITCH_CLIENT_SECRET: 'client-secret' }, () => {
    assert.deepEqual(getTwitchConfig(), { clientId: 'client-id', clientSecret: 'client-secret' })
  }))
