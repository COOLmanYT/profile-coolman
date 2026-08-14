'use client'

import { useState } from 'react'

export default function ShareCard() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const share = async () => {
    const url = window.location.origin
    try {
      if (navigator.share) {
        await navigator.share({ title: 'COOLman', text: 'Check out COOLman’s profile', url })
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff0000"/><stop offset="1" stop-color="#750000"/></linearGradient></defs><rect width="1200" height="630" fill="url(#background)"/><rect x="55" y="55" width="1090" height="520" rx="42" fill="#000" fill-opacity=".18" stroke="#fff" stroke-opacity=".28" stroke-width="3"/><text x="120" y="180" fill="#fff" font-family="Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="8" opacity=".72">COOLMAN PROFILE</text><text x="120" y="330" fill="#fff" font-family="Arial, sans-serif" font-size="110" font-weight="800">COOLman</text><text x="120" y="395" fill="#fff" font-family="Arial, sans-serif" font-size="40" opacity=".84">just a cool dude making content</text><text x="120" y="505" fill="#fff" font-family="Arial, sans-serif" font-size="28" opacity=".72">${url.replace(/&/g, '&amp;')}</text></svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = 'coolman-profile-card.svg'
    link.click()
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
    setMessage('Share card downloaded')
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className="transition-colors hover:text-white/80">Share</button>
      {open && <section className="absolute bottom-7 left-1/2 z-40 w-64 -translate-x-1/2 rounded-xl border border-white/15 bg-[#191919]/95 p-3 text-left shadow-2xl backdrop-blur" role="dialog" aria-label="Share profile">
        <p className="text-sm font-semibold text-white">Share COOLman’s profile</p>
        <p className="mt-1 break-all text-[11px] text-white/50">{typeof window === 'undefined' ? '' : window.location.origin}</p>
        <button onClick={share} className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500">Share or copy link</button>
        <button onClick={downloadCard} className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">Download share card</button>
        {message && <p className="mt-2 text-[11px] text-white/60">{message}</p>}
      </section>}
    </div>
  )
}
