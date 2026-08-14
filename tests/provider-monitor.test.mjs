import assert from 'node:assert/strict'
import test from 'node:test'
import { SLOW_PROVIDER_REQUEST_MS, providerIssue } from '../lib/provider-monitor.mjs'

test('classifies provider failures and slow responses without recording visitor data', () => {
  assert.deepEqual(providerIssue('spotify', 20, 503), { provider: 'spotify', kind: 'upstream_error', status: 503, durationMs: 20 })
  assert.deepEqual(providerIssue('twitch', SLOW_PROVIDER_REQUEST_MS, 200), { provider: 'twitch', kind: 'slow_response', status: 200, durationMs: SLOW_PROVIDER_REQUEST_MS })
  assert.deepEqual(providerIssue('discord', 10, undefined, new Error('offline')), { provider: 'discord', kind: 'network_error', durationMs: 10 })
  assert.equal(providerIssue('youtube', 20, 200), null)
})
