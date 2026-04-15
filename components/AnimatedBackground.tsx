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

  // Zone heights adapt to banner presence:
  //   With banner:    shorter zones so the wave edges stay near the banner strip,
  //                   leaving the centre clear for the image.
  //   Without banner: taller zones so the white and black waves meet in the
  //                   centre, "dancing" against the red gradient behind them.
  const zoneHeight = bannerUrl ? '40vh' : '55vh'

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/*
        ── RED GRADIENT BASE ──
        Always present beneath everything.  Visible in the centre gap between
        the white top wave and the black bottom wave (the "dancing" zone).
      */}
      <div className="absolute inset-0 banner-gradient-animated" />

      {/*
        ── BANNER STRIP ──
        Horizontal strip centred in the viewport.  Rendered above the gradient
        base but below the wave overlays, so wave edges organically frame it.
        min-width 1600 px / min-height 400 px per spec.
      */}
      {bannerUrl && (
        <div
          className="absolute left-0 right-0"
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            height: 'max(400px, 25vh)',
            minWidth: '1600px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
        </div>
      )}

      {/*
        ── WHITE TOP ZONE ──
        Solid white fills from the top edge down to the organic wave curve.
        No gradient fade — the wave PATH is the crisp boundary.  Using a
        transparent fade over the red base would composite to pink
        (0.5 × white + 0.5 × red = pink); solid white avoids this entirely.
        Asymmetric bezier segments (widths 360-700 px, peaks y=57-63, troughs
        y=90-96) give the wave a natural, non-uniform look.
        Seamless tile: first CP (2720,60) mirrors last CP (160,90).
      */}
      <div
        className="absolute top-0 left-0 right-0 overflow-hidden"
        style={{ height: zoneHeight }}
      >
        <svg
          className="absolute top-0 left-0 h-full wave-top"
          style={{ width: '200%' }}
          viewBox="0 0 2880 100"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,0 L2880,0 L2880,75
               C2720,60 2480,94 2280,75
               C2080,57 1820,96 1600,75
               C1400,59 1100,93  900,75
               C 710,60  520,91  360,75
               C 240,62  160,90    0,75 Z"
            fill="white"
          />
        </svg>
      </div>

      {/*
        ── BLACK BOTTOM ZONE ──
        Solid black fills from the bottom edge up to the organic wave curve.
        Vertical mirror of the white top zone.
        Seamless tile: first CP (2720,40) mirrors last CP (160,10).
      */}
      <div
        className="absolute bottom-0 left-0 right-0 overflow-hidden"
        style={{ height: zoneHeight }}
      >
        <svg
          className="absolute top-0 left-0 h-full wave-bottom"
          style={{ width: '200%' }}
          viewBox="0 0 2880 100"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,100 L2880,100 L2880,25
               C2720,40 2480, 6 2280,25
               C2080,43 1820, 4 1600,25
               C1400,41 1100, 7  900,25
               C 710,40  520, 9  360,25
               C 240,38  160,10    0,25 Z"
            fill="black"
          />
        </svg>
      </div>
    </div>
  )
}
