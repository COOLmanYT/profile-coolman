import assert from 'node:assert/strict'
import test from 'node:test'
import * as dimensions from '../lib/statistics-dimensions.mjs'
import { siteConfig } from '../lib/site-config.mjs'
import { loadTypescript } from './load-typescript.mjs'
import * as jsxRuntime from 'react/jsx-runtime'

function browser({ dnt = '0', gpc = false, referrer = 'https://google.com/search?email=private@example.test#secret' } = {}) {
  const previous = Object.fromEntries(['navigator','document','Element','fetch'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]))
  const callbacks = new Map(), calls = []
  class Target {
    constructor(href) { this.href = href }
    closest() { return { getAttribute: () => this.href, hasAttribute: () => false } }
  }
  Object.defineProperty(globalThis,'navigator',{ configurable: true, value: { doNotTrack: dnt, globalPrivacyControl: gpc } })
  Object.defineProperty(globalThis,'document',{ configurable: true, value: { referrer, addEventListener: (type, fn, capture) => { assert.equal(capture,true); callbacks.set(type,fn) }, removeEventListener: type => callbacks.delete(type) } })
  Object.defineProperty(globalThis,'Element',{ configurable: true, value: Target })
  Object.defineProperty(globalThis,'fetch',{ configurable: true, value: async (...args) => { calls.push(args); return { ok: true, json: async () => ({ count: 1 }) } } })
  return { calls, callbacks, click: (href, type = 'click', button = 0) => callbacks.get(type)?.({ target: new Target(href), type, button, defaultPrevented: false }), cleanup: () => { for (const [key,descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key] } } }
}

test('profile click tracking honours its global/config switches and browser privacy signals', () => {
  for (const scenario of ['off','config-off','outbound-off','dnt','gpc']) {
    const env = browser({ dnt: scenario === 'dnt' ? '1' : '0', gpc: scenario === 'gpc' })
    try {
      const config = structuredClone(siteConfig)
      if (scenario === 'config-off') config.analytics.enabled = false
      if (scenario === 'outbound-off') config.analytics.collect.outbound = false
      const { default: Tracker } = loadTypescript('components/ProfileClickTracking.tsx', { react: { useEffect: effect => effect() }, '@/lib/site-config.mjs': { siteConfig: config }, '@/lib/statistics-dimensions.mjs': dimensions })
      Tracker({ enabled: scenario !== 'off' })
      assert.equal(env.callbacks.size,0,scenario)
      assert.deepEqual(env.calls,[])
    } finally { env.cleanup() }
  }
})

test('shared click tracking strips URL details, supports middle clicks and caps requests with cleanup', () => {
  const env = browser(), originalNow = Date.now
  let now = 10000, cleanup
  Date.now = () => now
  try {
    const { default: Tracker } = loadTypescript('components/ProfileClickTracking.tsx', { react: { useEffect: effect => { cleanup = effect() } }, '@/lib/statistics-dimensions.mjs': dimensions })
    Tracker({ enabled: true })
    env.click('/dashboard'); env.click('/api/views'); assert.equal(env.calls.length,0)
    env.click('https://youtube.com/watch?token=private#secret')
    assert.deepEqual(JSON.parse(env.calls[0][1].body),{ destination: 'youtube.com' })
    assert.equal(env.calls[0][1].keepalive,true)
    env.click('/options'); assert.equal(env.calls.length,1,'rapid duplicate work is suppressed')
    now += 1000; env.click('/options','auxclick',1)
    assert.deepEqual(JSON.parse(env.calls[1][1].body),{ destination: '/options' })
    now += 1000; env.click('/options','auxclick',2); assert.equal(env.calls.length,2)
    for (let i=0;i<40;i++) { now += 1000; env.click('/privacy') }
    assert.equal(env.calls.length,30)
    cleanup(); assert.equal(env.callbacks.size,0)
  } finally { Date.now = originalNow; env.cleanup() }
})

test('view counter sends only the referrer origin, and omits referrer data when disabled or opted out', async () => {
  for (const scenario of ['on','off','category-off','dnt','gpc']) {
    const env = browser({ dnt: scenario === 'dnt' ? '1' : '0', gpc: scenario === 'gpc' })
    try {
      const config = structuredClone(siteConfig)
      if (scenario === 'category-off') config.analytics.collect.referrer = false
      const { default: Counter } = loadTypescript('components/ViewCounter.tsx', { react: { useEffect: effect => effect(), useState: () => [null,() => {}] }, 'react/jsx-runtime': jsxRuntime, '@/lib/site-config.mjs': { siteConfig: config } })
      Counter({ analyticsEnabled: scenario !== 'off' })
      await Promise.resolve()
      assert.equal(env.calls.length,1)
      if (scenario === 'on') assert.deepEqual(JSON.parse(env.calls[0][1].body),{ referrer: 'https://google.com' })
      else assert.equal(env.calls[0][1].body,undefined)
    } finally { env.cleanup() }
  }
})
