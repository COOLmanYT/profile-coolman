'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { validBrowserId } from '@/lib/profile-likes.mjs'

const ID_KEY = 'coolman-like-browser'
const RECEIPT_KEY = 'coolman-profile-liked'
type LikeData = { count: number; liked: boolean; browserId: string; added?: boolean }

async function persistentId() {
  const read = () => {
    try {
      const stored = localStorage.getItem(ID_KEY)
      if (validBrowserId(stored)) return stored!
      const id = crypto.randomUUID()
      localStorage.setItem(ID_KEY, id)
      return id
    } catch { return undefined }
  }
  return navigator.locks ? navigator.locks.request('coolman-like-identity', read) : read()
}

export default function LikeCounter() {
  const [count, setCount] = useState<number | null>(null)
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [burst, setBurst] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const browserId = useRef<string>()
  const inFlight = useRef(false)
  const animation = useRef<ReturnType<typeof setTimeout>>()
  const submission = useRef<AbortController>()
  const accept = useCallback((data: LikeData) => {
    browserId.current = data.browserId
    setCount(data.count)
    let remembered = false
    try {
      localStorage.setItem(ID_KEY, data.browserId)
      remembered = localStorage.getItem(RECEIPT_KEY) === '1'
      if (data.liked) localStorage.setItem(RECEIPT_KEY, '1')
    } catch { /* The server cookie still remembers this browser. */ }
    setLiked(data.liked || remembered)
    setError(false)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      const id = await persistentId()
      const response = await fetch('/api/likes', { signal: controller.signal, cache: 'no-store', headers: id ? { 'x-profile-browser-id': id } : {} })
      if (!response.ok) throw new Error('Likes unavailable')
      const data = await response.json() as LikeData
      if (!controller.signal.aborted) accept(data)
    })().catch(() => { if (!controller.signal.aborted) setError(true) })
    const onStorage = (event: StorageEvent) => { if (event.key === RECEIPT_KEY && event.newValue === '1') setLiked(true) }
    window.addEventListener('storage', onStorage)
    return () => { controller.abort(); submission.current?.abort(); clearTimeout(animation.current); window.removeEventListener('storage', onStorage) }
  }, [accept, attempt])
  const like = async () => {
    if (inFlight.current || liked || !browserId.current) return
    inFlight.current = true
    setBusy(true)
    const controller = new AbortController()
    submission.current = controller
    try {
      const response = await fetch('/api/likes', { method: 'POST', signal: controller.signal, headers: { 'x-profile-browser-id': browserId.current } })
      if (!response.ok) throw new Error('Like failed')
      const data = await response.json() as LikeData
      if (controller.signal.aborted) return
      accept(data)
      if (data.added) { setBurst(true); clearTimeout(animation.current); animation.current = setTimeout(() => setBurst(false), 850) }
    } catch { if (!controller.signal.aborted) setError(true) }
    finally { inFlight.current = false; if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className="relative text-right">
    <button type="button" onClick={like} disabled={busy || liked || count === null} aria-pressed={liked} aria-label={liked ? `Liked · ${count ?? 0} likes` : `Like this profile · ${count === null ? 'loading' : `${count} likes`}`} title={error ? 'Likes temporarily unavailable' : liked ? 'Thanks! Your browser has already liked this profile.' : 'Like this profile'} className={`relative inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-300 ${liked ? 'text-rose-300' : 'text-white/50 enabled:hover:bg-white/10 enabled:hover:text-rose-300'} ${burst ? 'profile-like-pop' : ''}`}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
      <span className="font-mono">{count === null ? '—' : count.toLocaleString()}</span>
      {burst && Array.from({ length: 6 }, (_, index) => <span key={index} aria-hidden className="profile-like-spark" style={{ '--spark-angle': `${index * 60}deg` } as CSSProperties}>♥</span>)}
    </button>
    {error && <span role="status" className="block text-[10px] text-white/50">{count === null ? <>Likes unavailable. <button type="button" className="underline" onClick={() => setAttempt((value) => value + 1)}>Retry</button></> : 'Could not like. Try again.'}</span>}
  </div>
}
