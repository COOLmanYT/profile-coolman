'use client'

import { useEffect, useState } from 'react'
import { siteConfig } from '@/lib/site-config.mjs'

export default function ViewCounter({ analyticsEnabled = false }: { analyticsEnabled?: boolean }) {
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    const increment = async () => {
      try {
        const privacy = navigator as Navigator & { globalPrivacyControl?: boolean }
        const includeReferrer = analyticsEnabled && siteConfig.analytics.enabled && siteConfig.analytics.collect.referrer && !(siteConfig.analytics.respectPrivacySignals && (navigator.doNotTrack === '1' || privacy.globalPrivacyControl))
        let referrer = ''
        if (includeReferrer && document.referrer) {
          try { const url = new URL(document.referrer); if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) referrer = url.origin } catch { /* Unavailable referrer. */ }
        }
        const res = await fetch('/api/views', { method: 'POST', ...(includeReferrer ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ referrer }) } : {}) })
        if (res.ok) {
          const data = await res.json()
          setViews(data.count)
        }
      } catch {
        // silently fail
      }
    }
    increment()
  }, [analyticsEnabled])

  if (views === null) return null

  return (
    <div>
      <span className="text-white/50 text-[11px] font-mono tracking-wide">
        👁 {views.toLocaleString()}
      </span>
    </div>
  )
}
