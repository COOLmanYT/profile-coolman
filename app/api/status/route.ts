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
    const components = (summary.components ?? []).slice(0, 3).flatMap((component) => component.name ? [{
      name: component.name,
      status: normaliseState(component.status),
      description: component.description,
    }] : [])
    const rawState = summary.status ?? summary.page?.status
    return NextResponse.json({ state: normaliseState(rawState), label: rawState ?? 'Status unavailable', components }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
  } catch {
    return NextResponse.json({ state: 'unknown', label: 'Status temporarily unavailable', components: [] }, { headers: { 'Cache-Control': 'public, s-maxage=30' } })
  }
}
