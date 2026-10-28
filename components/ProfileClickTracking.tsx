'use client'

import { useEffect } from 'react'
import { siteConfig } from '@/lib/site-config.mjs'
import { destinationKey } from '@/lib/statistics-dimensions.mjs'

// Mounted only on the public profile, alongside its existing view counter.
export default function ProfileClickTracking({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    const privacy = navigator as Navigator & { globalPrivacyControl?: boolean }
    if (!enabled || !siteConfig.analytics.enabled || !siteConfig.analytics.collect.outbound || (siteConfig.analytics.respectPrivacySignals && (navigator.doNotTrack === '1' || privacy.globalPrivacyControl))) return
    let sent = 0, lastSent = 0
    const record = (event: MouseEvent) => {
      if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1) || (event.type === 'click' && event.button !== 0)) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!link || link.hasAttribute('download')) return
      const key = destinationKey(link.getAttribute('href'), siteConfig)
      const now = Date.now()
      if (!key || sent >= 30 || now - lastSent < 1000) return
      sent++; lastSent = now
      // The destination key already excludes queries, fragments and arbitrary paths.
      void fetch('/api/views/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destination: key }), keepalive: true }).catch(() => {})
    }
    document.addEventListener('click', record, true)
    document.addEventListener('auxclick', record, true)
    return () => { document.removeEventListener('click', record, true); document.removeEventListener('auxclick', record, true) }
  }, [enabled])
  return null
}
