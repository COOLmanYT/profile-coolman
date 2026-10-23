import test from 'node:test'
import assert from 'node:assert/strict'
import { getGameActivityLink } from '../lib/game-activity.mjs'

test('game activity uses an explicit Steam app link and strips unrelated query parameters', () => {
  for (const field of ['details_url', 'state_url', 'url']) {
    assert.deepEqual(getGameActivityLink({ type: 0, name: 'Portal 2', [field]: 'https://store.steampowered.com/app/620/Portal_2/?snr=example' }), { href: 'https://store.steampowered.com/app/620/', source: 'steam' })
  }
  assert.equal(getGameActivityLink({ type: 5, name: 'Portal 2', assets: { large_url: 'https://store.steampowered.com/app/620' } }).source, 'steam')
})

test('game activity searches the name plus game when no valid Steam link is available', () => {
  for (const url of [undefined, 'javascript:alert(1)', 'https://store.steampowered.com.evil.test/app/620/', 'https://store.steampowered.com/search/?term=Portal', 'http://store.steampowered.com/app/620/', 'https://user@store.steampowered.com/app/620/']) {
    const link = getGameActivityLink({ type: 0, name: ' Desktop Detective & Friends ', application_id: '123456789', url })
    assert.equal(new URL(link.href).searchParams.get('q'), 'Desktop Detective & Friends game')
    assert.equal(new URL(link.href).hostname, 'duckduckgo.com')
  }
})

test('non-game and unnamed activity stays unlinked', () => {
  for (const type of [1, 2, 3, 4]) assert.equal(getGameActivityLink({ type, name: 'Spotify' }), null)
  for (const name of ['', ' ', null, undefined]) assert.equal(getGameActivityLink({ type: 0, name }), null)
})
