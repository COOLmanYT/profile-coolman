'use client'

import { useLanyard } from '@/lib/use-lanyard'
import { readAnnouncement } from '@/lib/live-announcement.mjs'
import type { Announcement } from '@/lib/dashboard-settings'

export default function LiveAnnouncement({ managed }: { managed?: Announcement | null }) {
  return managed === undefined ? <LanyardAnnouncement /> : <AnnouncementBody announcement={managed} />
}
function LanyardAnnouncement() {
  const { presence, unavailable } = useLanyard()
  const announcement = !unavailable && readAnnouncement(presence?.kv)
  return <AnnouncementBody announcement={announcement || null} />
}
function AnnouncementBody({ announcement }: { announcement: Announcement | null }) {
  if (!announcement) return null

  return (
    <aside aria-label="Live announcement" aria-live="polite" className="w-full rounded-2xl border border-amber-200/25 bg-amber-100/10 px-4 py-3 text-left">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">A little update</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">{announcement.message}</p>
      {announcement.url && <a href={announcement.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-amber-200 underline underline-offset-4">Find out more ↗</a>}
    </aside>
  )
}
