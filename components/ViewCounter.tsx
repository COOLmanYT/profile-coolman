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
    <div className="absolute -bottom-8 left-0">
      <span className="text-white/40 text-xs font-mono">
        👁 {views.toLocaleString()} views
      </span>
    </div>
  )
}
