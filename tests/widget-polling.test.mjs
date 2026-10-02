import assert from 'node:assert/strict'
import test from 'node:test'
import { startPolling, fetchWidgetJson } from '../lib/widget-polling.mjs'

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
function environment() {
  const jobs = new Map(), listeners = new Set()
  let id = 0
  const visibility = {
    hidden: false,
    addEventListener: (_, callback) => listeners.add(callback),
    removeEventListener: (_, callback) => listeners.delete(callback),
  }
  const timers = {
    setTimeout: (callback, delay) => { jobs.set(++id, { callback, delay }); return id },
    clearTimeout: (key) => jobs.delete(key),
  }
  return {
    jobs, listeners, visibility, timers,
    hide(hidden) { visibility.hidden = hidden; for (const callback of listeners) callback() },
    async tick() { const [key, job] = jobs.entries().next().value; jobs.delete(key); job.callback(); await settle() },
  }
}

test('polling backs off after failures and resets delay after recovery', async () => {
  const env = environment()
  let failures = 0, errors = 0
  const stop = startPolling({ ...env, intervalMs: 100, maxDelayMs: 250, poll: async () => { if (++failures < 3) throw new Error('failed') }, onError: () => errors++ })
  await settle()
  assert.equal([...env.jobs.values()][0].delay, 200)
  await env.tick()
  assert.equal([...env.jobs.values()][0].delay, 250)
  await env.tick()
  assert.equal([...env.jobs.values()][0].delay, 100)
  assert.equal(errors, 2)
  stop()
  assert.equal(env.jobs.size, 0)
  assert.equal(env.listeners.size, 0)
})

test('hidden tabs abort requests, resume immediately, and ignore late responses after cleanup', async () => {
  const env = environment(), signals = [], completions = []
  let errors = 0
  const stop = startPolling({ ...env, intervalMs: 100, poll: (signal) => { signals.push(signal); return new Promise((resolve) => completions.push(resolve)) }, onError: () => errors++ })
  assert.equal(signals.length, 1)
  assert.equal(env.jobs.size, 1) // Only the timeout; no overlapping poll.
  env.hide(true)
  assert.equal(signals[0].aborted, true)
  env.hide(false)
  assert.equal(signals.length, 2)
  completions[0]()
  await settle()
  assert.equal(env.jobs.size, 1)
  stop()
  assert.equal(signals[1].aborted, true)
  completions[1]()
  await settle()
  assert.equal(errors, 0)
  assert.equal(env.jobs.size, 0)
})

test('polling waits for visibility and times out stalled requests before retrying', async () => {
  const env = environment()
  env.visibility.hidden = true
  let calls = 0, errors = 0
  const stop = startPolling({ ...env, intervalMs: 100, poll: (signal) => { calls++; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) }, onError: () => errors++ })
  assert.equal(calls, 0)
  env.hide(false)
  assert.equal(calls, 1)
  await env.tick()
  assert.equal(errors, 1)
  assert.equal([...env.jobs.values()][0].delay, 200)
  stop()
})

test('widget JSON rejects HTTP failures, invalid JSON, and unavailable providers before accepting data', async () => {
  const original = globalThis.fetch
  try {
    for (const response of [Response.json({}, { status: 503 }), Response.json({}, { status: 429 }), new Response('invalid'), Response.json({ providerStatus: 'unavailable' })]) {
      globalThis.fetch = async () => response
      await assert.rejects(fetchWidgetJson('/api/test', new AbortController().signal))
    }
    globalThis.fetch = async () => Response.json({ isPlaying: false, providerStatus: 'healthy' })
    assert.equal((await fetchWidgetJson('/api/test', new AbortController().signal)).isPlaying, false)
  } finally { globalThis.fetch = original }
})
