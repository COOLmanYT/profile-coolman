'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function AvatarImage() {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <svg viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="88" height="88" fill="rgba(0,0,0,0.25)" />
        <circle cx="44" cy="34" r="16" fill="rgba(255,255,255,0.45)" />
        <ellipse cx="44" cy="74" rx="26" ry="18" fill="rgba(255,255,255,0.45)" />
      </svg>
    )
  }

  return (
    <Image
      src="/avatar.png"
      alt="COOLman"
      fill
      className="object-cover"
      unoptimized
      onError={() => setFailed(true)}
    />
  )
}
