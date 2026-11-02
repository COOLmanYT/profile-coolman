import { isModuleAvailable } from '@/lib/site-config.mjs'
import { siteConfig } from '@/lib/site-config.mjs'
import { NextRequest, NextResponse } from 'next/server'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'
import { createStatusData } from '@/lib/status-components.mjs'

const STATUS_URL = siteConfig.providers.status.componentsUrl

type StatusComponent = { name?: string; status?: string; description?: string; group?: { name?: string } | null }
type StatusResponse = { components?: StatusComponent[] }
let pendingRefresh: ReturnType<typeof loadStatus> | undefined

async function loadStatus() {
  try {
    const response = await monitoredFetch('instatus', STATUS_URL, { next: { revalidate: 60 } })
    if (!response.ok) throw new Error('Status service unavailable')
    const data = await response.json() as StatusResponse
    const status = createStatusData((data.components ?? []).filter((component) => component.name))
    return { data: status, cacheControl: 'public, s-maxage=60, stale-while-revalidate=120' }
  } catch {
    const summary = [{ name: 'Profile page', state: 'unknown', label: 'Status temporarily unavailable' }, { name: siteConfig.providers.status.label, state: 'unknown', label: 'Status temporarily unavailable' }]
    return { data: { services: [], summary }, cacheControl: 'public, s-maxage=30' }
  }
}

export async function GET(req: NextRequest) {
  if (!isModuleAvailable('status')) return NextResponse.json({ error: 'MODULE_DISABLED' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const rate = limitPublicRequest(req, 'status')
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  // Only simultaneous refreshes share work; subsequent requests can see changes.
  pendingRefresh ??= loadStatus().finally(() => { pendingRefresh = undefined })
  const result = await pendingRefresh
  return NextResponse.json(result.data, { headers: { 'Cache-Control': result.cacheControl } })
}
