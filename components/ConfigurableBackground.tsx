'use client'

import { useEffect, useRef, useState } from 'react'
import { siteConfig } from '@/lib/site-config.mjs'

export default function ConfigurableBackground() {
  const background = siteConfig.appearance.background
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [motion, setMotion] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setMotion(!query.matches && document.visibilityState === 'visible')
    update()
    query.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    return () => { query.removeEventListener('change', update); document.removeEventListener('visibilitychange', update) }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (motion) void video.play().catch(() => { /* Autoplay can be blocked; keep the poster. */ })
    else video.pause()
  }, [motion])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || background.type !== 'preset') return
    let frame = 0
    const started = performance.now()
    const draw = (now: number) => {
      const width = window.innerWidth, height = window.innerHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      const time = motion && background.animation !== 'none' ? (now - started) / 1000 * background.speed : 0
      const colors = background.colors
      context.fillStyle = colors[0]; context.fillRect(0, 0, width, height)
      if (background.preset === 'waves') {
        for (let side = 0; side < 2; side++) for (let layer = 0; layer < 3; layer++) {
          context.beginPath(); context.moveTo(0, side ? height : 0)
          for (let x = 0; x <= width + 4; x += 4) {
            const amplitude = background.animation === 'pulse' ? .7 + Math.sin(time * .6) * .3 : 1
            const displacement = amplitude * Math.sin(x * .003 + time * .4 + layer * 1.6) * height * .06 + Math.sin(x * .005 - time * .25) * height * .025
            const y = height * (.3 + layer * .07) + displacement
            context.lineTo(x, side ? height - y : y)
          }
          context.lineTo(width, side ? height : 0); context.closePath()
          context.globalAlpha = .55 + layer * .1; context.fillStyle = colors[side + 1] ?? colors[0]; context.fill()
        }
      } else {
        const phase = background.animation === 'pulse' ? .5 + Math.sin(time * .4) * .2 : .5
        const x = width * (.5 + Math.sin(time * .15) * .2)
        const gradient = background.preset === 'aurora'
          ? context.createRadialGradient(x, height * phase, 0, x, height * phase, Math.max(width, height))
          : context.createLinearGradient(width * Math.sin(time * .15) * .3, 0, width, height * (1 + Math.sin(time * .2) * .3))
        colors.forEach((color, index) => gradient.addColorStop(index / Math.max(1, colors.length - 1), color))
        context.fillStyle = gradient; context.fillRect(0, 0, width, height)
      }
      context.globalAlpha = 1
      if (motion && background.animation !== 'none') frame = requestAnimationFrame(draw)
    }
    draw(performance.now())
    const resize = () => { if (!motion || background.animation === 'none') draw(performance.now()) }
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize) }
  }, [background, motion])

  const style = { width: '100%', height: '100%', objectFit: background.fit as 'cover' | 'contain', objectPosition: background.position }
  return <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0, background: background.colors[0] }}>
    {background.type === 'preset' && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}
    {background.type === 'video' && !failed && <video ref={videoRef} src={motion ? background.src : undefined} poster={background.poster || undefined} muted loop playsInline preload="none" onError={() => setFailed(true)} style={style} />}
    {(background.type === 'image' || (background.type === 'gif' && motion)) && !failed &&
      // eslint-disable-next-line @next/next/no-img-element
      <img src={background.src} alt="" onError={() => setFailed(true)} style={style} />}
    {background.type === 'gif' && !motion && background.poster &&
      // eslint-disable-next-line @next/next/no-img-element
      <img src={background.poster} alt="" style={style} />}
    <div className="absolute inset-0 bg-black" style={{ opacity: background.overlay }} />
  </div>
}
