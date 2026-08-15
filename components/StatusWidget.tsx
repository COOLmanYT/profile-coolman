'use client'

import { useEffect, useState } from 'react'

type HealthState = 'operational' | 'maintenance' | 'degraded' | 'outage' | 'unknown'
type StatusData = { services: Array<{ name: string; state: HealthState; label: string }>; summary?: Array<{ name: string; state: HealthState; label: string }> }

const STATUS_URL = '/status'
const STATE_STYLE: Record<HealthState, string> = {
  operational: 'bg-emerald-400', maintenance: 'bg-amber-300', degraded: 'bg-amber-400', outage: 'bg-red-500', unknown: 'bg-white/35',
}

export default function StatusWidget() {
  const [status, setStatus] = useState<StatusData | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' })
        if (!response.ok) throw new Error()
        const data = await response.json() as StatusData
        if (active) setStatus(data)
      } catch {
        if (active) setStatus({ services: [], summary: [{ name: 'Profile page', state: 'unknown', label: 'Status temporarily unavailable' }, { name: 'COOLman brand', state: 'unknown', label: 'Status temporarily unavailable' }] })
      }
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  const services = status?.summary ?? [{ name: 'Profile page', state: 'unknown' as const, label: 'Checking status…' }, { name: 'COOLman brand', state: 'unknown' as const, label: 'Checking status…' }]
  return (
    <a href={STATUS_URL} className="mt-3 block w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition-colors hover:bg-black/30" aria-label="Open COOLman status page">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-white/85">Status</span><span className="text-xs text-white/45">↗</span></div>
      <div className="mt-2 space-y-1.5">{services.map((service) => <div key={service.name} className="flex items-center gap-2"><span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATE_STYLE[service.state]}`} aria-hidden /><span className="min-w-0 flex-1 text-[10px] text-white/75">{service.name}</span><span className="max-w-[45%] truncate text-[10px] text-white/40">{service.label}</span></div>)}</div>
    </a>
  )
}
