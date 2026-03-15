'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface SpotifyTrack {
  isPlaying: boolean
  title?: string
  artist?: string
  albumArt?: string
  songUrl?: string
}

export default function SpotifyWidget() {
  const [track, setTrack] = useState<SpotifyTrack | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrack = async () => {
      try {
        const res = await fetch('/api/spotify')
        if (res.ok) {
          const data = await res.json()
          setTrack(data)
        }
      } catch {
        setTrack({ isPlaying: false })
      } finally {
        setLoading(false)
      }
    }
    fetchTrack()
    const interval = setInterval(fetchTrack, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full bg-black/25 rounded-2xl p-3 border border-white/10">
      <div className="flex items-center gap-1.5 mb-2.5">
        <svg className="w-3 h-3 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        <span className="text-[#1DB954] text-[10px] font-bold tracking-widest uppercase">Listening on Spotify</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-white/10 rounded-lg animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <div className="h-3 bg-white/10 rounded animate-pulse mb-1.5 w-3/4" />
            <div className="h-2.5 bg-white/10 rounded animate-pulse w-1/2" />
          </div>
        </div>
      ) : track?.isPlaying ? (
        <a href={track.songUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          {track.albumArt && (
            <div className="relative w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden shadow-md">
              <Image src={track.albumArt} alt="Album art" fill className="object-cover" unoptimized />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate leading-tight">{track.title}</p>
            <p className="text-white/60 text-xs truncate mt-0.5">{track.artist}</p>
          </div>
          <div className="flex gap-0.5 items-end flex-shrink-0 h-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-[3px] bg-[#1DB954] rounded-full animate-bounce"
                style={{ height: `${6 + i * 4}px`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </a>
      ) : (
        <p className="text-white/40 text-xs">Not currently playing</p>
      )}
    </div>
  )
}
