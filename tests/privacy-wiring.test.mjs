import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import eslint from 'eslint'
import nextServer from 'next/server.js'
import configureNext from '../next.config.mjs'
import { validateSiteConfig } from '../lib/config-validation.mjs'
import { privacyBrowserGuard } from '../lib/privacy-browser.mjs'
import { installPrivacyNetworkGuard } from '../lib/privacy-client-network.mjs'
import { approvedEmbedUrl } from '../lib/privacy-embeds.mjs'
import * as privacyHttp from '../lib/privacy-http.mjs'
import * as privacyNetwork from '../lib/privacy-network.mjs'
import { auditPrivacyOutput } from '../lib/privacy-output.mjs'
import * as privacyPolicy from '../lib/privacy-policy.mjs'
import { siteConfig } from '../lib/site-config.mjs'
import { loadTypescript } from './load-typescript.mjs'

const tracker = 'https://region1.google-analytics.com/g/collect'
const runtimeError = /USER-PRIVACY-ERR-RUNTIME/
const routeDependencies = {
  'next/server': nextServer,
  '@/lib/privacy-http.mjs': privacyHttp,
  '@/lib/privacy-policy.mjs': privacyPolicy,
}

test('server startup guards direct fetches and preserves Next.js fetch options and metadata', async () => {
  const savedRuntime = process.env.NEXT_RUNTIME
  const savedFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = Object.assign(async (...args) => {
    calls.push(args)
    return new Response('ok')
  }, { __nextPatched: true })
  process.env.NEXT_RUNTIME = 'nodejs'
  try {
    const { register } = loadTypescript('instrumentation.ts', { './lib/privacy-network.mjs': privacyNetwork })
    await register()
    const guardedFetch = globalThis.fetch
    await register()
    assert.equal(globalThis.fetch, guardedFetch)
    assert.equal(guardedFetch.__nextPatched, true)
    await assert.rejects(guardedFetch(new Request(tracker)), runtimeError)
    assert.equal(calls.length, 0)

    const options = { next: { revalidate: 60 }, signal: AbortSignal.timeout(1000) }
    await guardedFetch('https://api.github.com/repos/COOLmanYT/profile-coolman', options)
    assert.equal(calls[0][1], options)
  } finally {
    globalThis.fetch = savedFetch
    if (savedRuntime === undefined) delete process.env.NEXT_RUNTIME
    else process.env.NEXT_RUNTIME = savedRuntime
  }
})

test('browser fetch, beacon and XHR block known trackers without a Content Security Policy', async () => {
  const requests = []
  const redirects = []
  const errors = []
  class FakeXhr {
    open(method, url) { requests.push([method, url]) }
  }
  const browser = {
    XMLHttpRequest: FakeXhr,
    fetch: async (url) => { requests.push(url); return new Response() },
    navigator: { sendBeacon: (url) => { requests.push(url); return true } },
    location: { replace: path => redirects.push(path) },
    console: { error: error => errors.push(error.message) },
  }
  const savedWindow = globalThis.window
  globalThis.window = browser
  try {
    loadTypescript('instrumentation-client.ts', { './lib/privacy-client-network.mjs': { installPrivacyNetworkGuard } })
  } finally {
    if (savedWindow === undefined) delete globalThis.window
    else globalThis.window = savedWindow
  }
  const guarded = browser.fetch
  installPrivacyNetworkGuard(browser)
  assert.equal(browser.fetch, guarded)
  await assert.rejects(browser.fetch(tracker), runtimeError)
  assert.equal(browser.navigator.sendBeacon(tracker), false)
  assert.throws(() => new FakeXhr().open('POST', tracker), runtimeError)
  assert.deepEqual(requests, [])
  assert.deepEqual(redirects, ['/privacy-blocked'])
  assert.match(errors[0], runtimeError)

  await browser.fetch('/api/views')
  assert.equal(browser.navigator.sendBeacon('/api/views/click'), true)
  new FakeXhr().open('GET', '/api/auth/providers')
  assert.deepEqual(requests, ['/api/views', '/api/views/click', ['GET', '/api/auth/providers']])
})

test('the fallback and API health guard work independently of the request proxy', async () => {
  const fallback = loadTypescript('app/privacy-blocked/route.ts', routeDependencies)
  const response = fallback.GET()
  assert.equal(response.status, 503)
  assert.equal(fallback.HEAD().body, null)
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/)
  const html = await response.text()
  assert.match(html, /bricked due to poor privacy/)
  assert.doesNotMatch(html, /<(?:script|link|img)\b/)

  const { rewrites } = await configureNext('phase-production-server')
  assert.deepEqual((await rewrites()).beforeFiles, privacyPolicy.trackerPathPrefixes.map(prefix => ({ source: `${prefix}/:path*`, destination: '/privacy-blocked' })))

  const { GET } = loadTypescript('app/api/health/route.ts', routeDependencies)
  const saved = process.env.NEXT_PUBLIC_GA_ID
  process.env.NEXT_PUBLIC_GA_ID = 'G-RUNTIME-TEST'
  try {
    await assert.rejects(configureNext('phase-production-build'), /USER-PRIVACY-ERR-BUILD/)
    const health = await GET()
    assert.equal(health.status, 503)
    assert.match((await health.json()).error, runtimeError)
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_GA_ID
    else process.env.NEXT_PUBLIC_GA_ID = saved
  }
})

test('configuration and widget checks reject trackers while preserving approved media and embeds', () => {
  const custom = structuredClone(siteConfig)
  custom.profile.avatar = 'https://example.com/avatar.png'
  assert.equal(validateSiteConfig(custom), custom)
  custom.profile.avatar = tracker
  assert.throws(() => validateSiteConfig(custom), /profile\.avatar.*USER-PRIVACY-ERR-BUILD/)

  const spotify = 'https://open.spotify.com/embed/track/abc'
  const youtube = 'https://www.youtube-nocookie.com/embed/abc?playsinline=1'
  assert.equal(approvedEmbedUrl('spotify', spotify), spotify)
  assert.equal(approvedEmbedUrl('youtube', youtube), youtube)
  for (const url of [tracker, youtube, 'https://open.spotify.com.example.org/embed/track/abc']) {
    assert.equal(approvedEmbedUrl('spotify', url), undefined)
  }
})

test('the postbuild check catches tracking added to emitted pages after the source check', async t => {
  const root = await mkdtemp(join(tmpdir(), 'profile-privacy-output-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'server', 'app'), { recursive: true })
  const config = await configureNext('phase-production-server')
  const rewrites = await config.rewrites()
  await writeFile(join(root, 'routes-manifest.json'), JSON.stringify({ rewrites, headers: [{ source: '/:path*', headers: [
    { key: 'Content-Security-Policy', value: "script-src 'self' 'unsafe-inline'; frame-src https://open.spotify.com" },
  ] }] }))
  await writeFile(join(root, 'app-path-routes-manifest.json'), JSON.stringify({ '/privacy-blocked/route': '/privacy-blocked' }))
  const page = join(root, 'server', 'app', 'index.html')
  const bootstrap = `<script>${privacyBrowserGuard()}</script>`
  await writeFile(page, `${bootstrap}<script src="/_next/static/app.js"></script><iframe src="https://open.spotify.com/embed/track/abc"></iframe>`)
  assert.deepEqual(await auditPrivacyOutput(root), [])

  await writeFile(page, `${bootstrap}<img src="${tracker}"><script src="https://new-tracker.example/ad.js"></script>`)
  assert.deepEqual(await auditPrivacyOutput(root), [
    'server/app/index.html: rendered advertising or tracking resource',
    'server/app/index.html: rendered externally hosted script',
  ])

  await writeFile(page, '<main>Profile</main>')
  await writeFile(join(root, 'routes-manifest.json'), JSON.stringify({ rewrites, headers: [] }))
  await writeFile(join(root, 'app-path-routes-manifest.json'), '{}')
  assert.deepEqual(await auditPrivacyOutput(root), [
    'server/app/index.html: the early browser privacy guard is missing',
    'the production Content Security Policy must restrict scripts to local and inline sources',
    'the standalone privacy failure route is missing',
  ])
})

test('lint independently rejects tracking SDK imports and accepts other Google integrations', async () => {
  const lint = new eslint.ESLint()
  const [invalid] = await lint.lintText(`import { GoogleAnalytics } from '@next/third-parties/google'\nimport { Analytics } from '@vercel/analytics/next'\nexport { GoogleAnalytics, Analytics }`, { filePath: 'app/privacy-probe.ts' })
  assert.equal(invalid.messages.filter(message => message.message.includes('USER-PRIVACY-ERR-LINT')).length, 2)
  const [valid] = await lint.lintText(`import { GoogleMaps } from '@next/third-parties/google'\nimport GoogleProvider from 'next-auth/providers/google'\nexport { GoogleMaps, GoogleProvider }`, { filePath: 'app/privacy-probe.ts' })
  assert.equal(valid.errorCount, 0)
})
