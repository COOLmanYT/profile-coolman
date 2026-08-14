'use client'

import { useState } from 'react'
import type { StatusSettings } from '@/lib/status-settings'

export default function StatusSettingsClient({ initialSettings }: { initialSettings: StatusSettings }) {
  const [settings, setSettings] = useState(initialSettings)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const save = async () => { setSaving(true); setMessage(null); try { const response = await fetch('/api/dashboard/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); if (!response.ok) throw new Error(); setMessage('Saved') } catch { setMessage('Could not save settings') } finally { setSaving(false) } }
  return <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4"><h2 className="text-sm font-semibold text-white">Instatus mapping</h2><p className="mt-1 text-xs text-white/45">Enter the exact Instatus component names shown in summary.json. Only these two status rows appear publicly.</p><label className="mt-4 block text-xs text-white/60">Profile page component<input value={settings.profileComponentName} onChange={(event) => setSettings((current) => ({ ...current, profileComponentName: event.target.value }))} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white" /></label><label className="mt-3 block text-xs text-white/60">COOLman brand component<input value={settings.brandComponentName} onChange={(event) => setSettings((current) => ({ ...current, brandComponentName: event.target.value }))} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white" /></label><div className="mt-4 flex items-center gap-3"><button onClick={save} disabled={saving} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save mapping'}</button>{message && <span className="text-xs text-white/60">{message}</span>}</div></section>
}
