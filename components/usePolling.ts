'use client'

import { useEffect, useRef } from 'react'

type PollOptions = {
  /** Interval between polls in milliseconds while the tab is visible. */
  intervalMs: number
  /** When true (the default), polling pauses while the document is hidden. */
  pauseWhenHidden?: boolean
}

/**
 * Polls an async fetcher on an interval, pausing while the tab is hidden and
 * re-fetching immediately when it becomes visible again. The fetcher receives
 * an AbortSignal so in-flight requests can be cancelled on unmount.
 *
 * The fetcher is called once immediately on mount (matching the previous
 * widget behaviour), then on each interval tick while visible.
 */
export function usePolling(
  fetcher: (signal: AbortSignal) => Promise<void> | void,
  { intervalMs, pauseWhenHidden = true }: PollOptions,
): void {
  // Keep the latest fetcher in a ref so the effect does not restart on every
  // render (the interval should be stable for the component's lifetime).
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null
    let abortController: AbortController | null = null

    const run = () => {
      abortController?.abort()
      abortController = new AbortController()
      const signal = abortController.signal
      Promise.resolve(fetcherRef.current(signal)).catch(() => {
        // Errors are handled by the caller; ignore here to avoid unhandled rejections.
      })
      if (!active) abortController?.abort()
    }

    const start = () => {
      if (timer) return
      run()
      timer = setInterval(() => {
        if (!pauseWhenHidden && typeof document !== 'undefined' && document.visibilityState !== 'visible') return
        run()
      }, intervalMs)
    }

    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') {
        start()
      } else if (pauseWhenHidden) {
        stop()
      }
    }

    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      start()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    return () => {
      active = false
      stop()
      abortController?.abort()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }
  }, [intervalMs, pauseWhenHidden])
}
