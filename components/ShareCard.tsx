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
  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className="transition-colors hover:text-white/80">Share</button>
      {open && <section className="absolute bottom-7 left-1/2 z-40 w-64 -translate-x-1/2 rounded-xl border border-white/15 bg-[#191919]/95 p-3 text-left shadow-2xl backdrop-blur" role="dialog" aria-label="Share profile">
        <p className="text-sm font-semibold text-white">Share COOLman’s profile</p>
        <p className="mt-1 break-all text-[11px] text-white/50">{typeof window === 'undefined' ? '' : window.location.origin}</p>
        <button onClick={share} className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500">Share or copy link</button>
        {message && <p className="mt-2 text-[11px] text-white/60">{message}</p>}
      </section>}
    </div>
  )
}
