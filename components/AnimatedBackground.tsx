'use client'

import { useEffect, useState } from 'react'

/** Try HEAD requests for local banner files in priority order. */
async function resolveLocalBanner(): Promise<string | null> {
  for (const path of ['/banner.png', '/banner.gif']) {
    try {
      const res = await fetch(path, { method: 'HEAD' })
      if (res.ok) return path
    } catch {
      // ignore network errors for each candidate
    }
  }
  return null
}

export default function AnimatedBackground() {
  // null = no banner / animated gradient | string = URL to display
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      // 1. Local repository banner files
      const local = await resolveLocalBanner()
      if (local) {
        if (!cancelled) setBannerUrl(local)
        return
      }

      // 2. Discord presence banner
      try {
        const res = await fetch('/api/discord')
        if (res.ok) {
          const data = (await res.json()) as {
            discord_user?: { id?: string; banner?: string }
          }
          const user = data?.discord_user
          if (user?.id && user?.banner) {
            // animated banners start with "a_" → gif; static → png
            const ext = user.banner.startsWith('a_') ? 'gif' : 'png'
            const url = `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${ext}?size=2048`
            if (!cancelled) setBannerUrl(url)
            return
          }
        }
      } catch {
        // ignore
      }

      // 3. No banner available — fall through to animated gradient
      if (!cancelled) setBannerUrl(null)
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* ── BLACK BASE — always visible underneath everything ── */}
      <div className="absolute inset-0 bg-black" />

      {/* ── BANNER / GRADIENT LAYER ── fills the full viewport ── */}
      {/* min-height / min-width ensure the source renders at ≥400px tall / 1600px wide */}
      <div
        className="absolute inset-0"
        style={{ minHeight: '400px', minWidth: '1600px' }}
      >
        {bannerUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={bannerUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
            }}
          />
        ) : (
          /* animated red gradient fallback */
          <div className="w-full h-full banner-gradient-animated" />
        )}
      </div>

      {/*
        ── WHITE TOP ZONE ──
        The SVG path fills white from y=0 (zone top) down to the wave curve,
        leaving the area below the wave transparent so the banner shows through
        cleanly.  No CSS mask needed — the wave IS the boundary.
        Zone height 45vh; wave occupies the bottom ~25 % of the zone.
      */}
      <div
        className="absolute top-0 left-0 right-0 overflow-hidden"
        style={{ height: '45vh' }}
      >
        <svg
          className="absolute top-0 left-0 h-full wave-top"
          style={{ width: '200%' }}
          viewBox="0 0 2880 100"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/*
            Fills white from y=0 down to the wave curve (centre ≈ y=77,
            crests y=64, troughs y=90).  Area below troughs is transparent
            → banner shows through without any colour mixing.
          */}
          <path
            d="M0,0 L2880,0 L2880,77
               C2640,64 2400,90 2160,77
               C1920,64 1680,90 1440,77
               C1200,64  960,90  720,77
               C 480,64  240,90    0,77 Z"
            fill="white"
          />
        </svg>
      </div>

      {/*
        ── BLACK BOTTOM ZONE ──
        Mirror of the white zone anchored to the bottom.
        SVG fills black from y=100 (zone bottom) up to the wave curve,
        leaving the area above the wave transparent.
      */}
      <div
        className="absolute bottom-0 left-0 right-0 overflow-hidden"
        style={{ height: '45vh' }}
      >
        <svg
          className="absolute top-0 left-0 h-full wave-bottom"
          style={{ width: '200%' }}
          viewBox="0 0 2880 100"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/*
            Fills black from y=100 up to the wave curve (centre ≈ y=23,
            crests y=10, troughs y=36).  Area above crests is transparent
            → banner shows through without any colour mixing.
          */}
          <path
            d="M0,100 L2880,100 L2880,23
               C2640,36 2400,10 2160,23
               C1920,36 1680,10 1440,23
               C1200,36  960,10  720,23
               C 480,36  240,10    0,23 Z"
            fill="black"
          />
        </svg>
      </div>
    </div>
  )
}
