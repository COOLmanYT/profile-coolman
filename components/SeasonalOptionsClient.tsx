'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SEASONAL_THEMES, type SeasonalTheme } from '@/lib/seasonal'
import { useSeasonalTheme } from './SeasonalThemeProvider'

const LABELS: Record<SeasonalTheme, string> = {
  christmas: 'Christmas',
  halloween: 'Halloween',
  easter: 'Easter',
  'new-year': 'New Year',
  birthday: 'Birthday',
}

export default function SeasonalOptionsClient() {
  const { preference, setPreference, activateOnce, timeZone } = useSeasonalTheme()
  const [theme, setTheme] = useState<SeasonalTheme>(preference.theme ?? 'christmas')
  const [until, setUntil] = useState(preference.until ? preference.until.slice(0, 16) : '')

  const saveUntil = () => {
    if (!until) return
    setPreference({ theme, until: new Date(until).toISOString() })
  }

  return (
    <div className="min-h-screen bg-[#151515] px-5 py-10 text-white">
      <main className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-5">
        <Link href="/" className="text-xs text-white/45 hover:text-white">← Back to profile</Link>
        <h1 className="mt-4 text-2xl font-bold">Seasonal Options</h1>
        <p className="mt-1 text-sm text-white/55">Automatic dates use your browser time zone: {timeZone}.</p>
        <label className="mt-6 block text-sm font-medium">Theme</label>
        <select value={theme} onChange={(event) => setTheme(event.target.value as SeasonalTheme)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm">
          {SEASONAL_THEMES.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}
        </select>
        <div className="mt-4 grid gap-2">
          <button onClick={() => activateOnce(theme)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">Turn on once for this visit</button>
          <label className="rounded-lg border border-white/10 p-3 text-sm">
            Turn on until a date and time
            <input type="datetime-local" value={until} onChange={(event) => setUntil(event.target.value)} className="mt-2 w-full rounded bg-black/25 px-2 py-1.5 text-white" />
          </label>
          <button onClick={saveUntil} disabled={!until} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold enabled:hover:bg-red-500 disabled:opacity-40">Save timed theme</button>
          <button onClick={() => { setPreference({ theme: null, until: null }); setUntil('') }} className="text-sm text-white/60 hover:text-white">Use automatic settings</button>
        </div>
      </main>
    </div>
  )
}
