import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { auditPrivacy, privacyBuildError } from '../lib/privacy-audit.mjs'
import { privacyBrowserGuard } from '../lib/privacy-browser.mjs'
import { monitoredFetch } from '../lib/provider-monitor.mjs'
import { privacyEnvironmentViolation } from '../lib/privacy-policy.mjs'

test('the build audit rejects ads, Google Analytics, tracker packages and external scripts', async t => {
  const root = await mkdtemp(join(tmpdir(), 'profile-privacy-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'profile.tsx'), `
    // Historical example: https://www.google-analytics.com/g/collect
    import { GoogleMaps } from '@next/third-parties/google'
    import GoogleProvider from 'next-auth/providers/google'
    export const page = <iframe src="https://www.youtube-nocookie.com/embed/abc" />
    export const viewEndpoint = '/api/views'
    export const channel = 'https://www.googleapis.com/youtube/v3/channels'
  `)
  assert.deepEqual(await auditPrivacy(root, { GOOGLE_CLIENT_ID: 'oauth-client' }), [])

  await writeFile(join(root, 'added.tsx'), `
    import { GoogleAnalytics as VisitorTracking } from '@next/third-parties/google'
    import { Analytics } from '@vercel/analytics/next'
    export const ad = <ins className="adsbygoogle" />
    export const tag = <script src="https://new-tracker.example/inject.js" />
  `)
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/posthog-js': {} } }))
  await writeFile(join(root, 'pixel.html'), '<img src="//stats.g.doubleclick.net/pixel">')
  const findings = await auditPrivacy(root, { NEXT_PUBLIC_GA_ID: 'G-SECRET' })
  const message = privacyBuildError(findings).message
  for (const expected of ['USER-PRIVACY-ERR-BUILD', 'Google Analytics', 'tracking package', 'tracking script or markup', 'externally hosted script', 'posthog-js', 'pixel.html', 'NEXT_PUBLIC_GA_ID']) {
    assert.ok(message.includes(expected), message)
  }
  assert.doesNotMatch(message, /G-SECRET|profile\.tsx/)
})

test('provider requests reject tracking destinations before sending any data', async () => {
  let calls = 0
  const fetcher = async () => {
    calls += 1
    return new Response('ok')
  }
  await assert.rejects(monitoredFetch('test', new Request('https://region1.google-analytics.com./g/collect'), {}, fetcher), /USER-PRIVACY-ERR-RUNTIME/)
  assert.equal(calls, 0)
  for (const url of ['https://accounts.google.com', 'https://api.lanyard.rest', 'https://google-analytics.com.example.org']) {
    assert.equal((await monitoredFetch('test', url, {}, fetcher)).status, 200)
  }
  assert.equal(privacyEnvironmentViolation({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }), undefined)
})

test('browser blocking redirects on enforced tracker loads and ignores ordinary media and extension errors', () => {
  const listeners = new Map()
  const errors = []
  const redirects = []
  runInNewContext(privacyBrowserGuard, {
    URL,
    document: { addEventListener: (name, listener) => listeners.set(name, listener) },
    location: { host: 'profile.coolmanyt.com', replace: path => redirects.push(path) },
    console: { error: error => errors.push(error.message) },
  })
  const violation = listeners.get('securitypolicyviolation')
  violation({ disposition: 'enforce', blockedURI: 'https://avatar.example/image.png', effectiveDirective: 'img-src' })
  violation({ disposition: 'enforce', blockedURI: 'chrome-extension://extension/content.js', effectiveDirective: 'script-src-elem' })
  violation({ disposition: 'report', blockedURI: 'https://www.google-analytics.com/g/collect', effectiveDirective: 'connect-src' })
  assert.deepEqual(redirects, [])

  violation({ disposition: 'enforce', blockedURI: 'https://www.google-analytics.com/g/collect', effectiveDirective: 'img-src' })
  violation({ disposition: 'enforce', blockedURI: 'https://www.googletagmanager.com/gtag/js', effectiveDirective: 'script-src-elem' })
  assert.deepEqual(redirects, ['/privacy-blocked'])
  assert.match(errors[0], /^USER-PRIVACY-ERR-RUNTIME/)
  assert.equal(errors.length, 1)
})
