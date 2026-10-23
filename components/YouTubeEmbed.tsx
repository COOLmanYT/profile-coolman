'use client'

import { useEffect, useState } from 'react'

export default function YouTubeEmbed({ id, title, url }: { id: string; title: string; url: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/youtube/embed?id=${encodeURIComponent(id)}`, { signal: controller.signal }).then(async (response) => {
      const data = response.ok ? await response.json() : null
      if (!controller.signal.aborted) setState(data?.available === true ? 'ready' : 'unavailable')
    }).catch(() => { if (!controller.signal.aborted) setState('unavailable') })
    return () => controller.abort()
  }, [id])
  return <div className="mt-2">
    {state === 'ready' ? <iframe title={`Play ${title}`} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0`} className="aspect-video min-h-[200px] w-full rounded-lg border-0 bg-black" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={() => setState('unavailable')} /> : <p role="status" className="rounded-lg bg-white/5 p-3 text-[11px] text-white/60">{state === 'loading' ? 'Checking YouTube player…' : 'The embedded player is unavailable for this upload.'}</p>}
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11px] text-red-200 hover:underline">{state === 'ready' ? 'Playback trouble? Watch on YouTube ↗' : 'Watch on YouTube ↗'}</a>
  </div>
}
