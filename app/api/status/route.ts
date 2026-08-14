import { NextResponse } from 'next/server'

const STATUS_URL = 'https://status.coolmanyt.com/summary.json'

type StatusComponent = { name?: string; status?: string; description?: string }
type StatusSummary = { status?: string; message?: string; page?: { status?: string; name?: string }; components?: StatusComponent[] }

function normaliseState(value?: string) {
  const state = value?.toLowerCase() ?? ''
  if (state.includes('operational') || state === 'up' || state === 'ok') return 'operational' as const
  if (state.includes('maintenance')) return 'maintenance' as const
  if (state.includes('degraded') || state.includes('partial') || state.includes('minor')) return 'degraded' as const
  if (state.includes('major') || state.includes('down') || state.includes('outage')) return 'outage' as const
  return 'unknown' as const
}

export async function GET() {
  try {
    const response = await fetch(STATUS_URL, { next: { revalidate: 60 } })
    if (!response.ok) throw new Error('Status service unavailable')
    const summary = await response.json() as StatusSummary
    const rawState = summary.status ?? summary.page?.status
    const relevant = (pattern: RegExp) => (summary.components ?? []).find((component) => pattern.test(component.name ?? ''))
    const profile = relevant(/profile|website/i)
    const brand = relevant(/coolman|brand/i)
    const services = [
      { name: 'Profile page', state: profile ? normaliseState(profile.status) : 'unknown' as const, label: profile?.status ?? 'Not separately tracked' },
      { name: 'COOLman brand', state: normaliseState(brand?.status ?? rawState), label: brand?.status ?? rawState ?? 'Status unavailable' },
    ]
    return NextResponse.json({ services }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
  } catch {
    return NextResponse.json({ services: [{ name: 'Profile page', state: 'unknown', label: 'Status temporarily unavailable' }, { name: 'COOLman brand', state: 'unknown', label: 'Status temporarily unavailable' }] }, { headers: { 'Cache-Control': 'public, s-maxage=30' } })
  }
}
