'use client'

import { useLanyard } from '@/lib/use-lanyard'
import { readAnnouncement } from '@/lib/live-announcement.mjs'
import type { Announcement } from '@/lib/dashboard-settings'

export default function LiveAnnouncement({ managed, placement = 'card' }: { managed?: Announcement | null; placement?: Announcement['placement'] }) {
  return managed === undefined ? <LanyardAnnouncement placement={placement} /> : <AnnouncementBody announcement={managed} placement={placement} />
}
function LanyardAnnouncement({ placement }: { placement: Announcement['placement'] }) {
  const { presence, unavailable } = useLanyard()
  const announcement = !unavailable && readAnnouncement(presence?.kv)
  return <AnnouncementBody announcement={announcement || null} placement={placement} />
}
function AnnouncementBody({ announcement, placement }: { announcement: Announcement | null; placement: Announcement['placement'] }) {
  if (!announcement || announcement.placement !== placement) return null
  const bar = placement === 'bar'

  return (
    <aside aria-label="Live announcement" aria-live="polite" className={bar ? 'relative z-10 w-full border-b border-amber-200/25 bg-[#302514] px-4 py-3 text-left' : 'w-full rounded-2xl border border-amber-200/25 bg-amber-100/10 px-4 py-3 text-left'}>
      <div className={bar ? 'mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1' : undefined}>
        {announcement.label && <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200 [overflow-wrap:anywhere]">{announcement.label}</p>}
        <p className={`${bar ? 'min-w-0' : 'mt-1'} whitespace-pre-wrap text-sm leading-relaxed text-white/90 [overflow-wrap:anywhere]`}>{announcement.message}</p>
        {announcement.url && <a href={announcement.url} target="_blank" rel="noopener noreferrer" className={`${bar ? '' : 'mt-2'} inline-block text-xs font-semibold text-amber-200 underline underline-offset-4 [overflow-wrap:anywhere]`}>{announcement.linkText} <span aria-hidden="true">↗</span></a>}
      </div>
    </aside>
  )
}
