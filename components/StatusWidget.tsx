'use client'

import { useEffect, useState } from 'react'

type HealthState = 'operational' | 'maintenance' | 'degraded' | 'outage' | 'unknown'
type StatusData = { state: HealthState; label: string; components: Array<{ name: string; status: HealthState; description?: string }> }

const STATUS_URL = 'https://status.coolmanyt.com'
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
        if (active) setStatus({ state: 'unknown', label: 'Status temporarily unavailable', components: [] })
      }
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  const state = status?.state ?? 'unknown'
  return (
    <a href={STATUS_URL} target="_blank" rel="noopener noreferrer" className="mt-3 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition-colors hover:bg-black/30" aria-label="Open COOLman status page">
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${STATE_STYLE[state]}`} aria-hidden />
      <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white/85">Website status</span><span className="block truncate text-[10px] text-white/45">{status?.label ?? 'Checking status…'}</span></span>
      <span className="text-xs text-white/45">↗</span>
    </a>
  )
}
