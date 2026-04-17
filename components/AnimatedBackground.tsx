'use client'

import { memo, useEffect, useRef, useState } from 'react'

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

// ─── Wave layer types ─────────────────────────────────────────────────────────

/** Parameters controlling one animated wave layer. */
interface WaveParams {
  /** Rest position as a fraction of canvas height from the near edge [0, 1]. */
  baseRatio: number
  /** Peak amplitude as a fraction of canvas height. */
  amplitude: number
  /** Spatial frequency in radians per pixel. */
  spatialFreq: number
  /** Temporal speed in radians per second. */
  speed: number
  /** Initial phase offset in radians. */
  phase: number
  /** Scroll direction: +1 = left-to-right, -1 = right-to-left. */
  dir: 1 | -1
}

/**
 * Evaluate the composite wave-boundary displacement at pixel x, time t (s).
 * Four harmonics with incommensurable frequency ratios (1 : 1.7 : 3.1 : 4.7)
 * ensure the pattern never exactly repeats → organic, non-mechanical motion.
 * Returns displacement in pixels (can be positive or negative).
 */
function wavePx(x: number, t: number, p: WaveParams, H: number): number {
  const A = p.amplitude * H
  const d = x * p.spatialFreq + t * p.speed * p.dir + p.phase
  return (
    A        * Math.sin(d) +
    A * 0.50 * Math.sin(d * 1.7 + 1.3) +
    A * 0.25 * Math.sin(d * 3.1 - 0.7) +
    A * 0.13 * Math.sin(d * 4.7 + 2.4)
  )
}

/**
 * Fill a wave-bounded region of the canvas.
 *   fromTop = true  → region between y = 0   and the wave boundary
 *   fromTop = false → region between y = H   and the wave boundary
 */
function drawWaveFill(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  params: WaveParams,
  fromTop: boolean,
  color: string,
  alpha: number,
): void {
  const baseY = fromTop ? params.baseRatio * H : H - params.baseRatio * H

  ctx.beginPath()
  if (fromTop) {
    ctx.moveTo(0, 0)
    ctx.lineTo(W, 0)
    for (let x = W; x >= 0; x -= 3) {
      ctx.lineTo(x, baseY + wavePx(x, t, params, H))
    }
  } else {
    ctx.moveTo(0, H)
    ctx.lineTo(W, H)
    for (let x = W; x >= 0; x -= 3) {
      ctx.lineTo(x, baseY + wavePx(x, t, params, H))
    }
  }
  ctx.closePath()

  ctx.globalAlpha = alpha
  ctx.fillStyle   = color
  ctx.fill()
  ctx.globalAlpha = 1.0
}

// ─── Layer definitions ────────────────────────────────────────────────────────
//
// Three white layers (top → down) and three black layers (bottom → up).
// Each pair of corresponding layers share the same wave shape so they "mirror"
// each other, while independent speeds/directions give them separate motion.
//
// Without banner: baseRatios reach 0.54 so both sides overlap slightly in the
//   centre, creating a "dancing" interplay between the two colours.
// With banner: baseRatios shrink to 0.38 so waves stop before the centre strip.

const NO_BANNER_TOP: WaveParams[] = [
  { baseRatio: 0.40, amplitude: 0.055, spatialFreq: 0.0024, speed: 0.45, phase: 0.0, dir:  1 },
  { baseRatio: 0.47, amplitude: 0.070, spatialFreq: 0.0017, speed: 0.37, phase: 1.6, dir: -1 },
  { baseRatio: 0.54, amplitude: 0.085, spatialFreq: 0.0031, speed: 0.56, phase: 3.1, dir:  1 },
]
const NO_BANNER_BOT: WaveParams[] = [
  { baseRatio: 0.40, amplitude: 0.055, spatialFreq: 0.0021, speed: 0.51, phase: 0.9, dir: -1 },
  { baseRatio: 0.47, amplitude: 0.070, spatialFreq: 0.0014, speed: 0.41, phase: 2.3, dir:  1 },
  { baseRatio: 0.54, amplitude: 0.085, spatialFreq: 0.0027, speed: 0.61, phase: 4.2, dir: -1 },
]

const BANNER_TOP: WaveParams[] = [
  { baseRatio: 0.27, amplitude: 0.045, spatialFreq: 0.0024, speed: 0.45, phase: 0.0, dir:  1 },
  { baseRatio: 0.32, amplitude: 0.055, spatialFreq: 0.0017, speed: 0.37, phase: 1.6, dir: -1 },
  { baseRatio: 0.38, amplitude: 0.065, spatialFreq: 0.0031, speed: 0.56, phase: 3.1, dir:  1 },
]
const BANNER_BOT: WaveParams[] = [
  { baseRatio: 0.27, amplitude: 0.045, spatialFreq: 0.0021, speed: 0.51, phase: 0.9, dir: -1 },
  { baseRatio: 0.32, amplitude: 0.055, spatialFreq: 0.0014, speed: 0.41, phase: 2.3, dir:  1 },
  { baseRatio: 0.38, amplitude: 0.065, spatialFreq: 0.0027, speed: 0.61, phase: 4.2, dir: -1 },
]

// Per-layer opacity: shallowest (most opaque) → deepest (most transparent).
// Overlapping semi-transparent fills blend naturally with the red background,
// producing smooth organic colour transitions instead of hard panel edges.
const LAYER_ALPHAS = [0.88, 0.76, 0.64] as const
const MIN_RENDER_SCALE = 0.55
const MAX_RENDER_SCALE_CAP = 1.5
const LOW_FPS_THRESHOLD = 42
const HIGH_FPS_THRESHOLD = 56
const FPS_SAMPLE_WINDOW_MS = 1200
const SCALE_STEP = 0.1

// ─── Component ────────────────────────────────────────────────────────────────

function AnimatedBackground() {
  const [bannerUrl, setBannerUrl]   = useState<string | null>(null)
  const canvasRef                   = useRef<HTMLCanvasElement>(null)
  const rafRef                      = useRef<number>(0)
  const renderScaleRef              = useRef<number>(1)
  const maxRenderScaleRef           = useRef<number>(1)
  const elapsedTimeRef              = useRef<number>(0)
  const lastFrameTimeRef            = useRef<number | null>(null)
  const fpsFramesRef                = useRef<number>(0)
  const fpsElapsedMsRef             = useRef<number>(0)
  const isPageHiddenRef             = useRef<boolean>(false)
  // Ref keeps the animation loop in sync with state without stale closures.
  const hasBannerRef                = useRef<boolean>(false)

  useEffect(() => {
    hasBannerRef.current = bannerUrl !== null
  }, [bannerUrl])

  // ── Banner resolution ──────────────────────────────────────────────────────
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

      // 3. No banner available — use animated canvas background only
      if (!cancelled) setBannerUrl(null)
    }

    resolve()
    return () => { cancelled = true }
  }, [])

  // ── Canvas animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function updateMaxRenderScale() {
      maxRenderScaleRef.current = Math.max(
        1,
        Math.min(MAX_RENDER_SCALE_CAP, window.devicePixelRatio || 1)
      )
      renderScaleRef.current = Math.min(renderScaleRef.current, maxRenderScaleRef.current)
    }

    function applyCanvasSize() {
      if (!canvas) return
      const scale = renderScaleRef.current
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale))
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale))
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
    }

    function resize() {
      updateMaxRenderScale()
      applyCanvasSize()
    }

    resize()
    window.addEventListener('resize', resize)

    function adaptRenderScale(fps: number) {
      if (fps < LOW_FPS_THRESHOLD && renderScaleRef.current > MIN_RENDER_SCALE) {
        renderScaleRef.current = Math.max(MIN_RENDER_SCALE, renderScaleRef.current - SCALE_STEP)
        applyCanvasSize()
      } else if (fps > HIGH_FPS_THRESHOLD && renderScaleRef.current < maxRenderScaleRef.current) {
        renderScaleRef.current = Math.min(maxRenderScaleRef.current, renderScaleRef.current + SCALE_STEP)
        applyCanvasSize()
      }
    }

    function draw(now: number) {
      if (!canvas || !ctx) return

      if (isPageHiddenRef.current) {
        rafRef.current = 0
        return
      }

      const previous = lastFrameTimeRef.current
      const frameDeltaMs = previous === null ? 16.67 : Math.min(120, Math.max(0, now - previous))
      lastFrameTimeRef.current = now
      elapsedTimeRef.current += frameDeltaMs / 1000

      fpsFramesRef.current += 1
      fpsElapsedMsRef.current += frameDeltaMs
      if (fpsElapsedMsRef.current >= FPS_SAMPLE_WINDOW_MS) {
        const fps = (fpsFramesRef.current * 1000) / fpsElapsedMsRef.current
        adaptRenderScale(fps)
        fpsFramesRef.current = 0
        fpsElapsedMsRef.current = 0
      }

      const W = window.innerWidth
      const H = window.innerHeight
      const t = elapsedTimeRef.current

      // ── 1. Animated red gradient background ────────────────────────────
      // Computed each frame from a slow sine → continuous, never twitches.
      // The diagonal direction gives the background more spatial richness.
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.18)
      const rMid  = Math.round(140 + 40 * pulse)   // 140–180
      const rEdge = Math.round( 95 + 25 * pulse)   //  95–120
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0,   `rgb(${rEdge}, 0, 0)`)
      bg.addColorStop(0.5, `rgb(${rMid},  0, 0)`)
      bg.addColorStop(1,   `rgb(${rEdge}, 0, 0)`)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // ── 2. White wave layers (top → down) ──────────────────────────────
      const topLayers = hasBannerRef.current ? BANNER_TOP : NO_BANNER_TOP
      topLayers.forEach((layer, i) => {
        drawWaveFill(ctx, W, H, t, layer, true,  '#ffffff', LAYER_ALPHAS[i])
      })

      // ── 3. Black wave layers (bottom → up) ─────────────────────────────
      const botLayers = hasBannerRef.current ? BANNER_BOT : NO_BANNER_BOT
      botLayers.forEach((layer, i) => {
        drawWaveFill(ctx, W, H, t, layer, false, '#000000', LAYER_ALPHAS[i])
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    function onVisibilityChange() {
      isPageHiddenRef.current = document.visibilityState !== 'visible'
      if (isPageHiddenRef.current) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
        lastFrameTimeRef.current = null
        return
      }
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    isPageHiddenRef.current = document.visibilityState !== 'visible'
    document.addEventListener('visibilitychange', onVisibilityChange)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/*
        Canvas fills the viewport and is drawn entirely in JS via rAF.
        No CSS keyframe animations → no loop-point twitching.
      */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/*
        ── BANNER STRIP ──
        Horizontal strip centred in the viewport, rendered above the canvas.
        min-width 1600 px / min-height 400 px per spec.
        When present, BANNER_TOP/BOT layer baseRatios are shorter so the wave
        edges frame the banner instead of covering it.
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
    </div>
  )
}

export default memo(AnimatedBackground)
