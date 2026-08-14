'use client'

import { useCallback, useEffect, useState } from 'react'

type HealthState = 'checking' | 'healthy' | 'warning' | 'error'
type ProviderResult = { name: string; state: HealthState; detail: string; checkedAt?: Date }

const providers = [
  { name: 'Discord', endpoint: '/api/discord', detail: (data: { discord_status?: string }) => data.discord_status ? `Presence: ${data.discord_status}` : 'No presence data' },
  { name: 'Spotify', endpoint: '/api/spotify', detail: (data: { isPlaying?: boolean; title?: string }) => data.isPlaying && data.title ? `Playing: ${data.title}` : 'Endpoint reachable' },
  { name: 'Twitch', endpoint: '/api/twitch', detail: (data: { isLive?: boolean }) => data.isLive ? 'Live now' : 'Endpoint reachable' },
  { name: 'YouTube', endpoint: '/api/youtube', detail: (data: { unavailable?: boolean }) => data.unavailable ? 'Latest-feed fallback active' : 'Latest feed available', warning: (data: { unavailable?: boolean }) => data.unavailable },
  { name: 'Instatus', endpoint: '/api/status', detail: (data: { services?: Array<{ state?: string }> }) => data.services?.some((service) => service.state === 'unknown') ? 'Status fallback active' : 'Status feed available', warning: (data: { services?: Array<{ state?: string }> }) => data.services?.some((service) => service.state === 'unknown') ?? false },
]

export default function ProviderHealthClient() {
  const [results, setResults] = useState<ProviderResult[]>(providers.map(({ name }) => ({ name, state: 'checking', detail: 'Checking…' })))
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setResults(providers.map(({ name }) => ({ name, state: 'checking', detail: 'Checking…' })))
    const results = await Promise.all(providers.map(async (provider): Promise<ProviderResult> => {
      try {
        const response = await fetch(provider.endpoint, { cache: 'no-store' })
        if (!response.ok) return { name: provider.name, state: 'error', detail: `Endpoint returned ${response.status}`, checkedAt: new Date() }
        const data = await response.json()
        return { name: provider.name, state: provider.warning?.(data) ? 'warning' : 'healthy', detail: provider.detail(data), checkedAt: new Date() }
      } catch {
        return { name: provider.name, state: 'error', detail: 'Could not reach endpoint', checkedAt: new Date() }
      }
    }))
    setResults(results)
    setRefreshing(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <section className="mt-6 border-t border-white/10 pt-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Provider health</h2><p className="mt-0.5 text-xs text-white/45">A live check of the profile&apos;s external integrations.</p></div><button type="button" onClick={() => void refresh()} disabled={refreshing} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white/75 transition-colors hover:bg-white/10 disabled:cursor-wait disabled:opacity-50">Refresh</button></div>
      <div className="mt-3 space-y-1.5">{results.map((result) => <div key={result.name} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"><span className="flex items-center gap-2 text-sm text-white/90"><span aria-label={result.state} className={`h-2 w-2 rounded-full ${result.state === 'healthy' ? 'bg-emerald-400' : result.state === 'warning' ? 'bg-amber-300' : result.state === 'error' ? 'bg-red-400' : 'bg-white/35'}`} />{result.name}</span><span className="max-w-[58%] truncate text-right text-[11px] text-white/45" title={result.detail}>{result.detail}{result.checkedAt ? ` · ${result.checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span></div>)}</div>
    </section>
  )
}
