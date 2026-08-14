'use client'

import { useState } from 'react'
import { SEASONAL_THEMES, type SeasonalSettings, type SeasonalTheme, type ThemeLocation } from '@/lib/seasonal'

const LABELS: Record<SeasonalTheme, string> = { christmas: 'Christmas', halloween: 'Halloween', easter: 'Easter', 'new-year': 'New Year', birthday: 'Birthday' }

function toInputValue(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 16) : ''
}

export default function SeasonalSettingsClient({ initialSettings }: { initialSettings: SeasonalSettings }) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const update = <K extends keyof SeasonalSettings>(key: K, value: SeasonalSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/dashboard/seasons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
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
      <h2 className="text-sm font-semibold text-white">Seasonal themes</h2>
      <p className="mt-1 text-xs text-white/45">Automatic events use each visitor’s time zone. A schedule can turn one event on for everyone in a chosen location.</p>
      <label className="mt-4 flex items-center justify-between text-sm text-white/85">Automatic calendar events
        <input type="checkbox" checked={settings.automaticEnabled} onChange={(event) => update('automaticEnabled', event.target.checked)} className="h-4 w-4 accent-red-600" />
      </label>
      <div className="mt-4 grid gap-3">
        <label className="text-xs text-white/60">Scheduled event
          <select value={settings.scheduledTheme ?? ''} onChange={(event) => update('scheduledTheme', event.target.value ? event.target.value as SeasonalTheme : null)} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white">
            <option value="">No scheduled event</option>
            {SEASONAL_THEMES.map((theme) => <option value={theme} key={theme}>{LABELS[theme]}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-white/60">Starts
            <input type="datetime-local" value={toInputValue(settings.scheduledStartsAt)} onChange={(event) => update('scheduledStartsAt', event.target.value ? new Date(event.target.value).toISOString() : null)} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-white/60">Ends
            <input type="datetime-local" value={toInputValue(settings.scheduledEndsAt)} onChange={(event) => update('scheduledEndsAt', event.target.value ? new Date(event.target.value).toISOString() : null)} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white" />
          </label>
        </div>
        <label className="text-xs text-white/60">Location
          <select value={settings.scheduledLocation} onChange={(event) => update('scheduledLocation', event.target.value as ThemeLocation)} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white">
            <option value="anywhere">Everywhere</option><option value="australia">Australia only</option><option value="outside-australia">Outside Australia only</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3"><button onClick={save} disabled={saving} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save themes'}</button>{message && <span className="text-xs text-white/60">{message}</span>}</div>
    </section>
  )
}
