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

test('serves a stale value while the loader errors after the TTL expires', async () => {
  let time = 1_000
  let fail = false
  const cache = createTtlCache({ ttlMs: 100, now: () => time })
  const load = async () => {
    if (fail) throw new Error('upstream down')
    return 'presence'
  }

  assert.equal(await cache.get(load), 'presence')
  time += 101
  fail = true
  // The previous snapshot is served instead of rejecting.
  assert.equal(await cache.get(load), 'presence')
})

test('rejects when the loader errors and no stale value exists', async () => {
  const cache = createTtlCache({ ttlMs: 100 })
  const load = async () => { throw new Error('upstream down') }
  await assert.rejects(() => cache.get(load), /upstream down/)
})
