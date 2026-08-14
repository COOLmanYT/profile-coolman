'use client'

import { useState } from 'react'
import type { LegalSettings } from '@/lib/legal-settings'

export default function LegalSettingsClient({ initialSettings }: { initialSettings: LegalSettings }) {
  const [simpleModeDefault, setSimpleModeDefault] = useState(initialSettings.simpleModeDefault)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/dashboard/legal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ simpleModeDefault }),
      })
      if (!response.ok) throw new Error()
      setMessage('Saved')
    } catch {
      setMessage('Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-semibold text-white">Legal pages</h2>
      <p className="mt-1 text-xs text-white/45">Choose the initial reading mode for the Terms and Privacy Policy. Visitors can override it in Options.</p>
      <label className="mt-4 flex items-center justify-between text-sm text-white/85">Use Simple Mode by default
        <input type="checkbox" checked={simpleModeDefault} onChange={(event) => setSimpleModeDefault(event.target.checked)} className="h-4 w-4 accent-red-600" />
      </label>
      <div className="mt-4 flex items-center gap-3"><button onClick={save} disabled={saving} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save legal settings'}</button>{message && <span className="text-xs text-white/60">{message}</span>}</div>
    </section>
  )
}
