import assert from 'node:assert/strict'
import test from 'node:test'
import { readAnnouncement } from '../lib/live-announcement.mjs'

test('announcements disappear when cleared, cap text, and reject unsafe optional links', () => {
  for (const kv of [undefined, null, {}, { announcement: '  ' }, { announcement: 2 }]) assert.equal(readAnnouncement(kv), null)
  assert.deepEqual(readAnnouncement({ announcement: ' New video! ', announcement_url: 'https://www.youtube.com/watch?v=hello' }), { message: 'New video!', url: 'https://www.youtube.com/watch?v=hello' })
  assert.equal(readAnnouncement({ announcement: 'a'.repeat(1000) }).message.length, 280)
  for (const announcement_url of ['javascript:alert(1)', 'data:text/html,test', '//evil.invalid', 'https://user:pass@example.com', 'http://example.com']) {
    assert.equal(readAnnouncement({ announcement: 'hello', announcement_url }).url, null)
  }
  assert.equal(readAnnouncement({ announcement: '<b>plain text</b>' }).message, '<b>plain text</b>')
})


test('hiding then showing Twitch does not restore an old live stream before fresh data arrives', async () => {
  const { loadTypescript } = await import('./load-typescript.mjs')
  const previousDocument = globalThis.document
  const listeners = new Set(), polls = []
  globalThis.document = { hidden: false, addEventListener: (_event, listener) => listeners.add(listener), removeEventListener: (_event, listener) => listeners.delete(listener) }
  let state, previousEnabled, nextEffect, cleanup, stops = 0
  let upstream = { isLive: true, title: 'Earlier live stream' }
  const { useTwitchPresence: readPresence } = loadTypescript('lib/use-twitch-presence.ts', {
    react: {
      useState: initial => { state ??= initial; return [state, next => { state = typeof next === 'function' ? next(state) : next }] },
      useEffect: (effect, [enabled]) => { if (enabled !== previousEnabled) { previousEnabled = enabled; nextEffect = effect } },
    },
    './widget-polling.mjs': { fetchWidgetJson: async () => upstream, startPolling: options => { polls.push(options); return () => { stops++ } } },
  })
  function render(enabled) {
    const result = readPresence(enabled)
    if (nextEffect) { const effect = nextEffect; nextEffect = undefined; cleanup?.(); cleanup = effect() }
    return result
  }
  try {
    render(true)
    await polls[0].poll(new AbortController().signal)
    assert.equal(render(true).presence.title, 'Earlier live stream')
    assert.equal(render(false).presence, null)
    assert.equal(stops, 1)
    assert.equal(listeners.size, 0)
    assert.equal(render(true).presence, null, 'must wait for a fresh response after being hidden')
    upstream = { isLive: false }
    await polls[1].poll(new AbortController().signal)
    assert.equal(render(true).presence.isLive, false)
  } finally {
    cleanup?.()
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
})
