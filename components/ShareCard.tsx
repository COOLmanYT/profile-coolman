'use client'

import { siteConfig } from '@/lib/site-config.mjs'

import { useState } from 'react'

export default function ShareCard() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const share = async () => {
    const url = window.location.origin
    try {
      if (navigator.share) {
        await navigator.share({ title: siteConfig.profile.username, text: `Check out ${siteConfig.profile.username}’s profile`, url })
        setMessage('Shared')
      } else {
        await navigator.clipboard.writeText(url)
        setMessage('Profile link copied')
      }
    } catch {
      setMessage('Share cancelled')
    }
  }
  const downloadCard = () => {
    const url = window.location.origin
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const context = canvas.getContext('2d')
    if (!context) return
    const gradient = context.createLinearGradient(0, 0, 1200, 630)
    gradient.addColorStop(0, siteConfig.appearance.card.from)
    gradient.addColorStop(1, siteConfig.appearance.card.to)
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgba(0, 0, 0, 0.18)'
    context.roundRect(55, 55, 1090, 520, 42)
    context.fill()
    context.strokeStyle = 'rgba(255, 255, 255, 0.28)'
    context.lineWidth = 3
    context.stroke()
    context.fillStyle = 'rgba(255,255,255,.72)'
    context.font = '700 30px Arial, sans-serif'
    context.fillText(`${siteConfig.profile.username.toUpperCase()} PROFILE`, 120, 180)
    context.fillStyle = '#fff'
    context.font = '800 110px Arial, sans-serif'
    context.fillText(siteConfig.profile.username, 120, 330)
    context.fillStyle = 'rgba(255,255,255,.84)'
    context.font = '40px Arial, sans-serif'
    context.fillText(siteConfig.profile.bio, 120, 395)
    context.fillStyle = 'rgba(255,255,255,.72)'
    context.font = '28px Arial, sans-serif'
    context.fillText(url, 120, 505)
    canvas.toBlob((blob) => {
      if (!blob) return
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = 'profile-card.png'
      link.click()
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
      setMessage('PNG share card downloaded')
    }, 'image/png')
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className="transition-colors hover:text-white/80">Share</button>
      {open && <section className="absolute bottom-7 left-1/2 z-40 w-64 -translate-x-1/2 rounded-xl border border-white/15 bg-[#191919]/95 p-3 text-left shadow-2xl backdrop-blur" role="dialog" aria-label="Share profile">
        <p className="text-sm font-semibold text-white">Share {siteConfig.profile.username}’s profile</p>
        <p className="mt-1 break-all text-[11px] text-white/50">{typeof window === 'undefined' ? '' : window.location.origin}</p>
        <button onClick={share} className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500">Share or copy link</button>
        <button onClick={downloadCard} className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">Download PNG share card</button>
        {message && <p className="mt-2 text-[11px] text-white/60">{message}</p>}
      </section>}
    </div>
  )
}
