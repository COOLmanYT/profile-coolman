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
    <div>
      <span className="text-white/50 text-[11px] font-mono tracking-wide">
        👁 {views.toLocaleString()}
      </span>
    </div>
  )
}
