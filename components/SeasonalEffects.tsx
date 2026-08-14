'use client'

import { useEffect, useState } from 'react'
import { useSeasonalTheme } from './SeasonalThemeProvider'

const snowflakes = Array.from({ length: 22 }, (_, index) => ({ left: `${(index * 37) % 100}%`, delay: `${(index % 9) * -1.1}s`, duration: `${7 + (index % 5)}s`, size: `${10 + (index % 6) * 2}px` }))
const confetti = Array.from({ length: 36 }, (_, index) => ({ left: `${(index * 23) % 100}%`, delay: `${(index % 12) * -0.25}s`, color: ['#ff3b30', '#ffd60a', '#34c759', '#0a84ff', '#bf5af2'][index % 5] }))

export default function SeasonalEffects() {
  const { theme, australian, timeZone } = useSeasonalTheme()
  const [melted, setMelted] = useState(false)
  const [lantern, setLantern] = useState(false)
  const [bunnies, setBunnies] = useState<number[]>([])
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone, month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(now)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
  const secondsToMidnight = theme === 'new-year' && values.month === 12 && values.day === 31 && values.hour === 23 && values.minute === 59 ? 60 - values.second : null
  const gifts = theme === 'christmas' && values.month === 12 && values.day === 25
  const showConfetti = theme === 'birthday' || (theme === 'new-year' && values.month === 1 && values.day === 1)

  return (
    <>
      {theme === 'christmas' && (
        <>
          {!australian && <div className="seasonal-snow" aria-hidden>{snowflakes.map((flake, index) => <span key={index} style={{ left: flake.left, animationDelay: flake.delay, animationDuration: flake.duration, fontSize: flake.size }}>❄</span>)}</div>}
          <button type="button" aria-label={melted ? 'Melted festive figure' : `Melt the ${australian ? 'sandman' : 'snowman'}`} onClick={() => setMelted(true)} className={`seasonal-figure seasonal-figure-left ${melted ? 'seasonal-melted' : ''}`}>
            <span className="seasonal-figure-main">{australian ? '🏖️' : '⛄'}</span>
            {gifts && <span className="seasonal-gifts" aria-hidden>🎁 🎁</span>}
          </button>
        </>
      )}
      {theme === 'halloween' && (
        <>
          {lantern && <div className="seasonal-lantern-light" aria-hidden />}
          <button type="button" aria-label="Light the pumpkin" onClick={() => setLantern((value) => !value)} className="seasonal-figure seasonal-figure-left seasonal-pumpkin">
            <span className="seasonal-figure-main">{lantern ? '🎃' : '🟠'}</span>
          </button>
        </>
      )}
      {theme === 'easter' && (
        <>
          <button type="button" aria-label="Release a bunny" onClick={() => setBunnies((items) => [...items, Date.now()])} className="seasonal-figure seasonal-figure-left seasonal-easter-basket">🧺🥚</button>
          {bunnies.map((id, index) => <span key={id} className="seasonal-bunny" style={{ animationDelay: `${index * 0.15}s` }} aria-hidden>🐇</span>)}
        </>
      )}
      {theme === 'new-year' && (
        <>
          {secondsToMidnight !== null && secondsToMidnight <= 10 && <div className="seasonal-countdown" role="status">{secondsToMidnight}</div>}
          {showConfetti && <div className="seasonal-confetti" aria-hidden>{confetti.map((piece, index) => <span key={index} style={{ left: piece.left, backgroundColor: piece.color, animationDelay: piece.delay }} />)}</div>}
        </>
      )}
      {theme === 'birthday' && (
        <>
          <div className="seasonal-confetti" aria-hidden>{confetti.map((piece, index) => <span key={index} style={{ left: piece.left, backgroundColor: piece.color, animationDelay: piece.delay }} />)}</div>
          <span className="seasonal-figure seasonal-figure-right minecraft-cake" aria-label="Minecraft birthday cake" role="img"><span /></span>
        </>
      )}
    </>
  )
}
