'use client'

import { useEffect, useState } from 'react'

const SEQUENCE = 'rm -rf /'
const MESSAGES = [
  'Deleting jackets...',
  'Deleting umbrellas...',
  'Deleting weather...',
]

export default function EasterEgg() {
  const [typed, setTyped] = useState('')
  const [active, setActive] = useState(false)
  const [visibleMessages, setVisibleMessages] = useState<string[]>([])

  useEffect(() => {
    console.log(
      '%c👀 Welcome developer. Yes, this is vibe coded. github.com/COOLmanYT',
      'color: #ff4444; font-size: 14px; font-weight: bold;'
    )
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (active) return
      const newTyped = (typed + e.key).slice(-SEQUENCE.length)
      setTyped(newTyped)
      if (newTyped === SEQUENCE) {
        setActive(true)
        setTyped('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [typed, active])

  useEffect(() => {
    if (!active) return
    setVisibleMessages([])
    let i = 0
    const interval = setInterval(() => {
      if (i < MESSAGES.length) {
        setVisibleMessages((prev) => [...prev, MESSAGES[i]])
        i++
      } else {
        clearInterval(interval)
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    }, 800)
    return () => clearInterval(interval)
  }, [active])

  if (!active) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-3">
      {visibleMessages.map((msg, i) => (
        <p key={i} className="text-green-400 font-mono text-lg animate-fade-in">
          {msg}
        </p>
      ))}
    </div>
  )
}
