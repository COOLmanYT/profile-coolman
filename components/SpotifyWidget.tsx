'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface SpotifyTrack {
  isPlaying: boolean
  isPaused?: boolean
  title?: string
  artist?: string
  artists?: string[]
  albumArt?: string
  songUrl?: string
  durationMs?: number
  progressMs?: number
  embedUrl?: string
  contextType?: string
  contextUrl?: string
}

const EQUALIZER_BARS = [
  { heightClass: 'h-[10px]', delayClass: '[animation-delay:0.15s]' },
  { heightClass: 'h-[14px]', delayClass: '[animation-delay:0.3s]' },
  { heightClass: 'h-[18px]', delayClass: '[animation-delay:0.45s]' },
]

interface SpotifyWidgetProps {
  showEmbed?: boolean
}

export default function SpotifyWidget({ showEmbed = true }: SpotifyWidgetProps) {
  const [track, setTrack] = useState<SpotifyTrack | null>(null)
  const [displayProgressMs, setDisplayProgressMs] = useState(0)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const formatDuration = (ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return '0:00'
    const total = Math.floor(ms / 1000)
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  useEffect(() => {
    const fetchTrack = async () => {
      try {
        const res = await fetch('/api/spotify', { cache: 'no-store' })
        const data = await res.json().catch(() => ({ isPlaying: false }))
        setTrack((prev) => {
          const next = data as SpotifyTrack
          if (prev?.songUrl === next.songUrl && prev?.progressMs === next.progressMs && prev?.isPlaying === next.isPlaying) {
            return prev
          }
          return next
        })
        setDisplayProgressMs(Math.max(0, data.progressMs ?? 0))
      } catch {
        setTrack({ isPlaying: false })
      } finally {
        setHasLoadedOnce(true)
      }
    }
    fetchTrack()
    const interval = setInterval(fetchTrack, 12000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!track?.durationMs) return
    setDisplayProgressMs(Math.max(0, track.progressMs ?? 0))
  }, [track?.songUrl, track?.progressMs, track?.durationMs])

  useEffect(() => {
    if (!track?.isPlaying || !track.durationMs) return
    const tick = setInterval(() => {
      setDisplayProgressMs((prev) => Math.min(prev + 1000, track.durationMs ?? prev))
    }, 1000)
    return () => clearInterval(tick)
  }, [track?.isPlaying, track?.durationMs])

  const artistsLabel = track?.artists?.length ? track.artists.join(', ') : (track?.artist ?? '')
  const durationMs = Math.max(0, track?.durationMs ?? 0)
  const progressMs = Math.min(Math.max(0, displayProgressMs), durationMs || displayProgressMs)
  const progressPercent = durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0
  const hasPlayback = !!track?.title
  const canShowEmbed = showEmbed && !!track?.embedUrl && hasPlayback

  return (
    <div className="w-full bg-black/25 rounded-2xl p-3 border border-white/10">
      <div className="flex items-center gap-1.5 mb-2.5">
        <svg className="w-3 h-3 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        <span className="text-[#1DB954] text-[10px] font-bold tracking-widest uppercase">Listening on Spotify</span>
      </div>
      {!hasLoadedOnce ? (
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-white/10 rounded-lg animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <div className="h-3 bg-white/10 rounded animate-pulse mb-1.5 w-3/4" />
            <div className="h-2.5 bg-white/10 rounded animate-pulse w-1/2" />
          </div>
        </div>
      ) : hasPlayback ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
          {track.albumArt && (
            <div className="relative w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden shadow-md">
              <Image src={track.albumArt} alt="Album art" fill className="object-cover" unoptimized />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {track.songUrl ? (
              <a href={track.songUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                <p className="text-white text-sm font-semibold leading-tight whitespace-normal">{track.title}</p>
              </a>
            ) : (
              <p className="text-white text-sm font-semibold leading-tight whitespace-normal">{track.title}</p>
            )}
            <p className="text-white/60 text-xs whitespace-normal mt-0.5">{artistsLabel}</p>
            {track.contextType === 'playlist' && track.contextUrl && (
              <p className="mt-1">
                <a
                  href={track.contextUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1DB954] text-[10px] font-medium hover:underline"
                >
                  Open playlist
                </a>
              </p>
            )}
          </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex gap-0.5 items-end h-5">
                {(track.isPlaying ? EQUALIZER_BARS : EQUALIZER_BARS.map((bar) => ({ ...bar, delayClass: '' }))).map((bar, idx) => (
                  <div
                    key={idx}
                    className={`w-[3px] bg-[#1DB954] rounded-full ${track.isPlaying ? 'animate-bounce' : 'opacity-40'} ${bar.heightClass} ${bar.delayClass}`}
                  />
                ))}
              </div>
              {!track.isPlaying && (
                <span className="text-[10px] text-white/45">Paused</span>
              )}
            </div>
          </div>

          {durationMs > 0 && (
            <div className="space-y-1">
              <div className="relative h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-[#1DB954] rounded-full transition-[width] duration-700 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[10px] text-white/60 flex items-center justify-between tabular-nums">
                <span>{formatDuration(progressMs)}</span>
                <span>{formatDuration(durationMs)}</span>
              </div>
            </div>
          )}

          {canShowEmbed && (
            <div className="w-full rounded-xl overflow-hidden border border-white/10 bg-black/20 h-[80px]">
              <iframe
                title="Spotify Embed Player"
                src={track.embedUrl}
                width="100%"
                height="80"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="block w-full h-[80px]"
              />
            </div>
          )}
        </div>
      ) : (
        <p className="text-white/40 text-xs">Not listening right now</p>
      )}
    </div>
  )
}
