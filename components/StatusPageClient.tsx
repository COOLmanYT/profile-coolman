'use client'

import { useEffect, useState } from 'react'

type HealthState = 'operational' | 'maintenance' | 'degraded' | 'outage' | 'unknown'
type Service = { name: string; state: HealthState; label: string }
const STATE_STYLE: Record<HealthState, { dot: string; text: string }> = {
  operational: { dot: 'bg-emerald-400', text: 'Operational' }, maintenance: { dot: 'bg-amber-300', text: 'Under maintenance' }, degraded: { dot: 'bg-amber-400', text: 'Degraded' }, outage: { dot: 'bg-red-500', text: 'Outage' }, unknown: { dot: 'bg-white/35', text: 'Unknown' },
}

export default function StatusPageClient() {
  const [services, setServices] = useState<Service[] | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' })
        if (!response.ok) throw new Error()
        const data = await response.json() as { services?: Service[] }
        if (active) { setServices(data.services ?? []); setCheckedAt(new Date()) }
      } catch { if (active) { setServices([]); setCheckedAt(new Date()) } }
    }
    void load()
    const interval = window.setInterval(load, 60_000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])
  return <section className="mt-7"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">All components</h2><span className="text-xs text-white/45">{checkedAt ? `Updated ${checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Checking…'}</span></div><div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-black/20">{services === null ? <p className="p-4 text-sm text-white/55">Loading live status…</p> : services.length === 0 ? <p className="p-4 text-sm text-white/55">Live component status is temporarily unavailable.</p> : services.map((service) => { const style = STATE_STYLE[service.state]; return <div key={service.name} className="flex items-start gap-3 p-4"><span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${style.dot}`} aria-hidden /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 className="text-sm font-semibold text-white/90">{service.name}</h3><span className="text-xs text-white/55">{style.text}</span></div>{service.label && service.label !== style.text && <p className="mt-1 text-xs leading-relaxed text-white/45">{service.label}</p>}</div></div> })}</div></section>
}
