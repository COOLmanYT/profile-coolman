import assert from 'node:assert/strict'
import test from 'node:test'
import { takeRateLimit, createRateLimiter } from '../lib/rate-limit.mjs'

test('limits repeated requests and resets after its time window', () => {
  const policy = { limit: 2, windowMs: 1_000 }
  assert.equal(takeRateLimit('test-rate-limit', policy, 0).allowed, true)
  assert.equal(takeRateLimit('test-rate-limit', policy, 1).allowed, true)
  const blocked = takeRateLimit('test-rate-limit', policy, 2)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfterSeconds, 1)
  assert.equal(takeRateLimit('test-rate-limit', policy, 1_000).allowed, true)
})

test('rate limiter cleans expired identities and bounds storage without evicting active limits', () => {
  const limiter = createRateLimiter({ maxBuckets: 2 })
  const policy = { limit: 1, windowMs: 1000 }
  assert.equal(limiter.take('a', policy, 0).allowed, true)
  assert.equal(limiter.take('b', policy, 0).allowed, true)
  assert.equal(limiter.take('c', policy, 1).allowed, false)
  assert.equal(limiter.size, 2)
  assert.equal(limiter.take('a', policy, 2).allowed, false)
  assert.equal(limiter.take('c', policy, 1000).allowed, true)
  assert.equal(limiter.size, 1)
})

test('prunes expired entries instead of dropping an active window at capacity', () => {
  const policy = { limit: 5, windowMs: 1_000 }
  // All these keys are created in the past (now=-2000), so every one is expired by
  // the time the active bucket below is touched (now=100).
  for (let i = 0; i < 12_000; i += 1) {
    takeRateLimit(`expired-${i}`, policy, -2000)
  }
  // An active bucket created and immediately re-checked in the present.
  assert.equal(takeRateLimit('active-bucket', policy, 100).allowed, true)
  const result = takeRateLimit('active-bucket', policy, 100)
  assert.equal(result.allowed, true)
  assert.equal(result.remaining, 3)
})
