import assert from 'node:assert/strict'
import test from 'node:test'
import { createStatusData } from '../lib/status-components.mjs'
import { loadTypescript, nextServer } from './load-typescript.mjs'

test('converts every Instatus v3 component into a status row and compact summary', () => {
  const result = createStatusData([
    { name: 'COOLman Profile Website', status: 'OPERATIONAL' },
    { name: 'DNS', description: 'Records updating', status: 'UNDERMAINTENANCE', group: { name: 'Vercel' } },
  ])
  assert.deepEqual(result.services, [
    { name: 'COOLman Profile Website', state: 'operational', label: 'OPERATIONAL' },
    { name: 'Vercel — DNS', state: 'maintenance', label: 'Records updating' },
  ])
  assert.equal(result.summary[0].state, 'operational')
  assert.deepEqual(result.summary[1], { name: 'COOLman brand', state: 'maintenance', label: '1/2 components operational' })
})

test('reports an unknown aggregate when Instatus has no component data', () => {
  const result = createStatusData([])
  assert.deepEqual(result.summary[1], { name: 'COOLman brand', state: 'unknown', label: 'No component data available' })
})

test('concurrent status refreshes share reads and parsing, with independent responses and immediate later updates', async () => {
  let release
  let gate = new Promise((resolve) => { release = resolve })
  let calls = 0, parses = 0, allowed = true, failed = false
  let status = 'OPERATIONAL'
  const { GET } = loadTypescript('app/api/status/route.ts', {
    'next/server': nextServer,
    '@/lib/rate-limit.mjs': { limitPublicRequest: () => ({ allowed, retryAfterSeconds: 30 }) },
    '@/lib/status-components.mjs': { createStatusData: (data) => { parses++; return createStatusData(data) } },
    '@/lib/provider-monitor.mjs': { monitoredFetch: async (_provider, _url, init) => {
      calls++
      assert.equal(init.next.revalidate, 60)
      await gate
      return failed ? new Response(null, { status: 503 }) : Response.json({ components: [{ name: 'Service', status }] })
    } },
  })
  const pending = [GET({}), GET({}), GET({})]
  assert.equal(calls, 1)
  allowed = false
  assert.equal((await GET({})).status, 429)
  allowed = true
  release()
  const responses = await Promise.all(pending)
  assert.equal(new Set(responses).size, 3)
  for (const response of responses) {
    assert.equal((await response.json()).services[0].state, 'operational')
    assert.equal(response.headers.get('Cache-Control'), 'public, s-maxage=60, stale-while-revalidate=120')
  }
  assert.equal(parses, 1)
  gate = Promise.resolve()
  status = 'MAJOROUTAGE'
  assert.equal((await (await GET({})).json()).services[0].state, 'outage')
  assert.equal(calls, 2)
  failed = true
  const fallback = await GET({})
  assert.equal(fallback.headers.get('Cache-Control'), 'public, s-maxage=30')
  assert.deepEqual((await fallback.json()).services, [])
  failed = false
  assert.equal((await (await GET({})).json()).services[0].state, 'outage')
  assert.equal(calls, 4)
})
