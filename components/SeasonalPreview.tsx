'use client'

import { useState } from 'react'
import { SEASONAL_THEMES, type SeasonalTheme } from '@/lib/seasonal'
import { useSeasonalTheme } from './SeasonalThemeProvider'

const LABELS: Record<SeasonalTheme, string> = { christmas: 'Christmas', halloween: 'Halloween', easter: 'Easter', 'new-year': 'New Year', birthday: 'Birthday' }
const ICONS: Record<SeasonalTheme, string> = { christmas: '⛄', halloween: '🎃', easter: '🧺🥚', 'new-year': '🎉', birthday: '🎂' }

export default function SeasonalPreview() {
  const { theme, australian, activateOnce, clearOnce } = useSeasonalTheme()
  const [selected, setSelected] = useState<SeasonalTheme | ''>(theme ?? '')
  const active = theme ?? selected
  return <section className="mt-8 border-t border-white/10 pt-5"><h2 className="text-base font-semibold">Seasonal event preview</h2><p className="mt-1 text-xs text-white/50">Preview an event for this visit without changing the public schedule.</p><div className="mt-3 flex gap-2"><select value={selected} onChange={(event) => setSelected(event.target.value as SeasonalTheme | '')} className="min-w-0 flex-1 rounded bg-black/25 px-2 py-2 text-sm text-white"><option value="">No preview</option>{SEASONAL_THEMES.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}</select><button type="button" onClick={() => selected ? activateOnce(selected) : clearOnce()} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold hover:bg-red-500">Preview</button></div>{active && <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-3xl" aria-hidden>{ICONS[active]}</span><div><p className="text-sm font-semibold">{LABELS[active]} is active</p><p className="mt-0.5 text-xs text-white/50">{active === 'christmas' && australian ? 'Australian sandman mode' : 'Previewing the visitor experience'}</p></div></div>}<button type="button" onClick={() => { setSelected(''); clearOnce() }} className="mt-3 text-sm text-white/60 hover:text-white">Clear preview</button></section>
}
