import assert from 'node:assert/strict'
import test from 'node:test'
import { createTtlCache } from '../lib/ttl-cache.mjs'

test('returns the cached value until the TTL expires', async () => {
  let time = 1_000
  let calls = 0
  const cache = createTtlCache({ ttlMs: 100, now: () => time })
  const load = async () => ({ value: ++calls })

  assert.deepEqual(await cache.get(load), { value: 1 })
  assert.deepEqual(await cache.get(load), { value: 1 })
  time += 101
  assert.deepEqual(await cache.get(load), { value: 2 })
})

test('deduplicates concurrent cache misses', async () => {
  let calls = 0
  const cache = createTtlCache({ ttlMs: 100 })
  const load = async () => {
    calls += 1
    await new Promise((resolve) => setTimeout(resolve, 5))
    return 'presence'
  }

  assert.deepEqual(await Promise.all([cache.get(load), cache.get(load)]), ['presence', 'presence'])
  assert.equal(calls, 1)
})
