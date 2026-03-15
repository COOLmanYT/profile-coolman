'use client'

import { useEffect, useState } from 'react'

export default function ViewCounter() {
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    const increment = async () => {
      try {
        const res = await fetch('/api/views', { method: 'POST' })
        if (res.ok) {
          const data = await res.json()
          setViews(data.count)
        }
      } catch {
        // silently fail
      }
    }
    increment()
  }, [])

  if (views === null) return null

  return (
    <div className="absolute -bottom-7 left-1">
      <span className="text-white/30 text-[11px] font-mono tracking-wide">
        👁 {views.toLocaleString()}
      </span>
    </div>
  )
}
