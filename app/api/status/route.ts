import { NextRequest, NextResponse } from 'next/server'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'
import { createStatusData } from '@/lib/status-components.mjs'

const STATUS_URL = 'https://status.coolmanyt.com/v3/components.json'

type StatusComponent = { name?: string; status?: string; description?: string; group?: { name?: string } | null }
type StatusResponse = { components?: StatusComponent[] }

export async function GET(req: NextRequest) {
  const rate = limitPublicRequest(req, 'status')
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  try {
    const response = await monitoredFetch('instatus', STATUS_URL, { next: { revalidate: 60 } })
    if (!response.ok) throw new Error('Status service unavailable')
    const data = await response.json() as StatusResponse
    const status = createStatusData((data.components ?? []).filter((component) => component.name))
    return NextResponse.json(status, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
  } catch {
    const summary = [{ name: 'Profile page', state: 'unknown', label: 'Status temporarily unavailable' }, { name: 'COOLman brand', state: 'unknown', label: 'Status temporarily unavailable' }]
    return NextResponse.json({ services: [], summary }, { headers: { 'Cache-Control': 'public, s-maxage=30' } })
  }
}
