'use client'

import { useEffect, useState } from 'react'

export default function AnimatedBackground() {
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/discord')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.discord_user as
          | { id?: string; banner?: string }
          | undefined
        if (user?.id && user?.banner) {
          const ext = user.banner.startsWith('a_') ? 'gif' : 'webp'
          setBannerUrl(
            `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${ext}?size=480`,
          )
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* ── BLACK BASE LAYER — fills the entire viewport ── */}
      <div className="absolute inset-0 bg-black" />

      {/* ── WHITE SOLID TOP SECTION ── */}
      <div
        className="absolute top-0 left-0 right-0 bg-white"
        style={{ height: '43%' }}
      />

      {/* ── MIDDLE BANNER LAYER ── */}
      {/* sits between the two wave zones, slightly overlapping each */}
      <div
        className="absolute left-0 right-0"
        style={{ top: '37%', bottom: '37%' }}
      >
        {bannerUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={bannerUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full banner-gradient-animated" />
        )}
        {/* Soft blending: fade white at top, fade black at bottom */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, white 0%, transparent 28%, transparent 72%, black 100%)',
          }}
        />
      </div>

      {/* ── WHITE WAVE — wavy bottom boundary of the white section ── */}
      {/*
          SVG is 200 % wide so translateX(-50 %) returns to the exact same
          visual state → perfectly seamless horizontal loop.
          viewBox 2880 = 2 × 1440 (standard viewport) → 2 full wave cycles.
          The path fills white from y=0 down to the organic wave edge.
      */}
      <div
        className="absolute left-0 right-0 overflow-hidden"
        style={{ top: '40%', height: '18vh' }}
      >
        <svg
          className="absolute top-0 h-full wave-top"
          style={{ width: '200%' }}
          viewBox="0 0 2880 100"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/*
            Starts at top-left → top-right → rides the wave back left.
            Wave centre ~y=50, amplitude ±30.
          */}
          <path
            d="M0,0 L2880,0 L2880,50
               C2640,80 2400,20 2160,50
               C1920,80 1680,20 1440,50
               C1200,80  960,20  720,50
               C 480,80  240,20    0,50 Z"
            fill="white"
          />
        </svg>
      </div>

      {/* ── BLACK WAVE — wavy top boundary of the black section ── */}
      {/*
          Same trick but the path fills black from y=100 up to the wave edge.
          Phase-shifted wave + different duration → independent motion.
          Animation runs in reverse direction for visual separation.
      */}
      <div
        className="absolute left-0 right-0 overflow-hidden"
        style={{ bottom: '40%', height: '18vh' }}
      >
        <svg
          className="absolute bottom-0 h-full wave-bottom"
          style={{ width: '200%' }}
          viewBox="0 0 2880 100"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/*
            Starts at bottom-left → bottom-right → rides the (phase-shifted)
            wave back left. Crests/troughs are inverted relative to the white wave.
          */}
          <path
            d="M0,100 L2880,100 L2880,50
               C2640,20 2400,80 2160,50
               C1920,20 1680,80 1440,50
               C1200,20  960,80  720,50
               C 480,20  240,80    0,50 Z"
            fill="black"
          />
        </svg>
      </div>
    </div>
  )
}
