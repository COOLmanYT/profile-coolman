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
  // undefined = still resolving | null = no banner found | string = URL to show
  const [bannerUrl, setBannerUrl] = useState<string | null | undefined>(undefined)

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

      {/* ── BANNER / GRADIENT LAYER ── fills the full viewport behind the wave zones */}
      {/* min-height / min-width ensure the source renders at ≥ 400 px tall / 1600 px wide */}
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
        ) : bannerUrl === null ? (
          /* animated red gradient fallback */
          <div className="w-full h-full banner-gradient-animated" />
        ) : null /* still resolving — black base shows through */}
      </div>

      {/*
        ── WHITE TOP ZONE ──
        A solid-white fill + animated wave SVG, all inside a container whose
        bottom half is masked out with a CSS gradient.  This means the zone
        fades from fully opaque-white at the very top to fully transparent at
        its bottom edge — no hard seam, no visible band.
      */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: '58vh',
          WebkitMaskImage:
            'linear-gradient(to bottom, white 40%, transparent 100%)',
          maskImage:
            'linear-gradient(to bottom, white 40%, transparent 100%)',
        }}
      >
        {/* solid white fill behind the wave */}
        <div className="absolute inset-0 bg-white" />

        {/* animated wave that creates the organic lower edge */}
        <div
          className="absolute left-0 right-0 overflow-hidden"
          style={{ bottom: 0, height: '35%' }}
        >
          <svg
            className="absolute top-0 h-full wave-top"
            style={{ width: '200%' }}
            viewBox="0 0 2880 100"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,0 L2880,0 L2880,55
                 C2640,85 2400,25 2160,55
                 C1920,85 1680,25 1440,55
                 C1200,85  960,25  720,55
                 C 480,85  240,25    0,55 Z"
              fill="white"
            />
          </svg>
        </div>
      </div>

      {/*
        ── BLACK BOTTOM ZONE ──
        Mirror of the white zone anchored to the bottom.  The CSS mask fades
        from fully opaque-black at the very bottom to transparent at the top
        edge — same seamless gradient-boundary technique.
      */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '58vh',
          WebkitMaskImage:
            'linear-gradient(to top, white 40%, transparent 100%)',
          maskImage:
            'linear-gradient(to top, white 40%, transparent 100%)',
        }}
      >
        {/* solid black fill behind the wave */}
        <div className="absolute inset-0 bg-black" />

        {/* animated wave that creates the organic upper edge */}
        <div
          className="absolute left-0 right-0 overflow-hidden"
          style={{ top: 0, height: '35%' }}
        >
          <svg
            className="absolute bottom-0 h-full wave-bottom"
            style={{ width: '200%' }}
            viewBox="0 0 2880 100"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,100 L2880,100 L2880,45
                 C2640,15 2400,75 2160,45
                 C1920,15 1680,75 1440,45
                 C1200,15  960,75  720,45
                 C 480,15  240,75    0,45 Z"
              fill="black"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
