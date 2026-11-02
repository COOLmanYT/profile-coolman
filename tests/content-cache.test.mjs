import assert from 'node:assert/strict'
import test from 'node:test'
import { createContentCache } from '../lib/content-cache.mjs'

test('unchanged source content skips parsing while updates and parser options take effect immediately', () => {
  const cache = createContentCache()
  let parses = 0
  const parse = (source) => { parses++; return JSON.parse(source) }
  assert.deepEqual(cache.get('channel-a', '{"views":1}', parse), { views: 1 })
  assert.deepEqual(cache.get('channel-a', '{"views":1}', parse), { views: 1 })
  assert.equal(parses, 1)
  assert.deepEqual(cache.get('channel-a', '{"views":2}', parse), { views: 2 })
  assert.deepEqual(cache.get('channel-b', '{"views":2}', parse), { views: 2 })
  assert.equal(parses, 3)
})

test('parsed content retention is bounded and failed parsing can be retried', () => {
  const cache = createContentCache({ maxEntries: 2 })
  let parses = 0
  const parse = (source) => { parses++; return JSON.parse(source) }
  cache.get('a', '1', parse)
  cache.get('b', '2', parse)
  cache.get('a', '1', parse)
  cache.get('c', '3', parse)
  cache.get('b', '2', parse)
  assert.equal(parses, 4)
  assert.throws(() => cache.get('a', '4', () => { throw new Error('invalid') }), /invalid/)
  assert.equal(cache.get('a', '4', parse), 4)
  assert.throws(() => createContentCache({ maxEntries: 0 }), RangeError)
})
