'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './ToastProvider'
import type { Announcement } from '@/lib/dashboard-settings'

export default function AnnouncementEditor({ initialAnnouncement }: { initialAnnouncement: Announcement | null }) {
  const [message, setMessage] = useState(initialAnnouncement?.message ?? '')
  const [url, setUrl] = useState(initialAnnouncement?.url ?? '')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const router = useRouter()
  const save = async (clear = false) => {
    setSaving(true)
    try {
      const response = await fetch('/api/dashboard/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'announcement', value: { message: clear ? '' : message, url: clear ? '' : url } }) })
      if (!response.ok) throw new Error('Could not save announcement')
      if (clear) { setMessage(''); setUrl('') }
      router.refresh()
      showToast({ variant: 'success', title: clear ? 'Announcement cleared' : 'Announcement published' })
    } catch { showToast({ variant: 'error', title: 'Could not save announcement' }) }
    finally { setSaving(false) }
  }
  return <section className="rounded-xl border border-white/10 bg-white/5 p-4">
    <h2 className="text-sm font-semibold text-white">Announcement</h2><p className="mt-1 text-xs text-white/50">Publish a plain-text update for visitors. Clearing it also suppresses any older Lanyard announcement.</p>
    <label className="mt-3 block text-xs text-white/70">Message<textarea maxLength={280} value={message} onChange={event => setMessage(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white" /></label>
    <p className="text-right text-[10px] text-white/40">{message.length}/280</p>
    <label className="mt-2 block text-xs text-white/70">Optional HTTPS link<input type="url" value={url} onChange={event => setUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white" /></label>
    <div className="mt-4 flex gap-2"><button disabled={saving || !message.trim()} onClick={() => save()} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Publish announcement</button><button disabled={saving} onClick={() => save(true)} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white disabled:opacity-40">Clear</button></div>
  </section>
}
