import assert from 'node:assert/strict'
import test from 'node:test'
import { takeRateLimit } from '../lib/rate-limit.mjs'

test('limits repeated requests and resets after its time window', () => {
  const policy = { limit: 2, windowMs: 1_000 }
  assert.equal(takeRateLimit('test-rate-limit', policy, 0).allowed, true)
  assert.equal(takeRateLimit('test-rate-limit', policy, 1).allowed, true)
  const blocked = takeRateLimit('test-rate-limit', policy, 2)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfterSeconds, 1)
  assert.equal(takeRateLimit('test-rate-limit', policy, 1_000).allowed, true)
})
