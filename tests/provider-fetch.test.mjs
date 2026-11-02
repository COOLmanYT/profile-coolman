import assert from 'node:assert/strict'
import test from 'node:test'
import { createProviderFetcher } from '../lib/provider-fetch.mjs'

test('provider rate limits prevent repeated upstream calls, count down and recover at the advertised reset', async () => {
  let clock = Date.UTC(2026, 10, 2)
  let calls = 0
  const requests = createProviderFetcher('twitch', async () => {
    calls++
    return calls === 1 ? new Response(null, { status: 429, headers: { 'Ratelimit-Reset': String(clock / 1000 + 120) } }) : Response.json({ ok: true })
  }, () => clock)
  assert.equal((await requests.fetch('test')).status, 429)
  assert.equal(requests.retryAfterSeconds, 120)
  await assert.rejects(requests.fetch('test'), /rate limited/)
  clock += 119_001
  assert.equal(requests.retryAfterSeconds, 1)
  await assert.rejects(requests.fetch('test'), /rate limited/)
  assert.equal(calls, 1)
  clock += 999
  assert.equal((await requests.fetch('test')).status, 200)
  assert.equal(requests.retryAfterSeconds, 0)
})

test('cooldowns honor seconds and HTTP dates, fall back safely, and remain isolated per provider', async () => {
  for (const header of ['90', new Date(Date.UTC(2026, 10, 2) + 90_000).toUTCString(), 'invalid']) {
    const clock = Date.UTC(2026, 10, 2)
    const limited = createProviderFetcher('discord', async () => new Response(null, { status: 429, headers: { 'Retry-After': header } }), () => clock)
    const other = createProviderFetcher('twitch', async () => new Response(null, { status: 200 }), () => clock)
    await limited.fetch('test')
    assert.equal(limited.retryAfterSeconds, header === 'invalid' ? 60 : 90)
    assert.equal((await other.fetch('test')).status, 200)
    assert.equal(other.retryAfterSeconds, 0)
  }
})

test('a late parallel response cannot shorten an existing provider cooldown', async () => {
  const finishes = []
  const requests = createProviderFetcher('twitch', () => new Promise((resolve) => finishes.push(resolve)), () => 0)
  const first = requests.fetch('first')
  const second = requests.fetch('second')
  finishes[0](new Response(null, { status: 429, headers: { 'Retry-After': '120' } }))
  await first
  finishes[1](new Response(null, { status: 429, headers: { 'Retry-After': '10' } }))
  await second
  assert.equal(requests.retryAfterSeconds, 120)
})
