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
