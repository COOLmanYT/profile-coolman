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
        SVG spans full zone height; organic wave path fills white from y=0 down
        to the wave curve.  A linearGradient fades the fill to transparent at
        the wave boundary so the edge blends softly into the banner behind it.
        Asymmetric bezier segments (widths 360-700 px, peaks y=57-63, troughs
        y=90-96) give the wave a natural, non-uniform look.
        Seamless tile: first CP (2720,60) mirrors last CP (160,90).
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
          <defs>
            <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="white" stopOpacity="1" />
              <stop offset="65%"  stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,0 L2880,0 L2880,75
               C2720,60 2480,94 2280,75
               C2080,57 1820,96 1600,75
               C1400,59 1100,93  900,75
               C 710,60  520,91  360,75
               C 240,62  160,90    0,75 Z"
            fill="url(#wt-grad)"
          />
        </svg>
      </div>

      {/*
        ── BLACK BOTTOM ZONE ──
        Vertical mirror of the white zone.  Gradient runs bottom-to-top so the
        wave crests reaching into the banner area dissolve softly.
        Seamless tile: first CP (2720,40) mirrors last CP (160,10).
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
          <defs>
            <linearGradient id="wb-grad" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="black" stopOpacity="1" />
              <stop offset="65%"  stopColor="black" stopOpacity="1" />
              <stop offset="100%" stopColor="black" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,100 L2880,100 L2880,25
               C2720,40 2480, 6 2280,25
               C2080,43 1820, 4 1600,25
               C1400,41 1100, 7  900,25
               C 710,40  520, 9  360,25
               C 240,38  160,10    0,25 Z"
            fill="url(#wb-grad)"
          />
        </svg>
      </div>
    </div>
  )
}
