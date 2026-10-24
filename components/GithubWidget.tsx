'use client'

import { useEffect, useState } from 'react'
import { fetchWidgetJson, startPolling } from '@/lib/widget-polling.mjs'

interface GithubActivity {
  items: Array<{ id: string; label: string; repo: string; url: string; createdAt: string }>
}

export default function GithubWidget() {
  const [activity, setActivity] = useState<GithubActivity | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => startPolling({
    intervalMs: 15 * 60 * 1000,
    poll: async (signal: AbortSignal) => {
      const data = await fetchWidgetJson('/api/github', signal) as GithubActivity
      if (signal.aborted) return
      setActivity(data)
      setUnavailable(false)
    },
    onError: () => setUnavailable(true),
  }), [])

  return (
    <section aria-label="GitHub activity" className="w-full rounded-2xl border border-white/15 bg-[#0d1117]/90 p-4">
      <a href="https://github.com/COOLmanYT" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm font-semibold text-white"><span>GitHub <span className="ml-1 text-xs font-normal text-white/50">@COOLmanYT</span></span><span aria-hidden>↗</span></a>
      <p className="mt-1 text-[10px] text-white/45">Recent public activity · refreshes every 15 minutes</p>
      {unavailable ? <p role="status" className="mt-3 text-xs text-white/55">GitHub activity temporarily unavailable.</p>
        : !activity ? <div className="mt-3 h-20 animate-pulse rounded-lg bg-white/5" aria-label="Loading GitHub activity" />
        : activity.items.length === 0 ? <p className="mt-3 text-xs text-white/55">No recent public activity. See what I’m building on GitHub ↗</p>
        : <ul className="mt-3 space-y-1">{activity.items.map(item => <li key={item.id}><a href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-2 py-2 transition-colors hover:bg-white/5"><p className="text-[11px] text-emerald-300">{item.label}</p><p className="mt-0.5 break-words text-xs font-medium text-white/85">{item.repo}</p><time dateTime={item.createdAt} className="mt-0.5 block text-[10px] text-white/40">{new Date(item.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</time></a></li>)}</ul>}
    </section>
  )
}
