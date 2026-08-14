'use client'

import { useSeasonalTheme } from './SeasonalThemeProvider'
import { useVisitorPreferences, type PerceivedLocation } from './VisitorPreferencesProvider'

export default function SeasonalSimulationControls({ compact = false }: { compact?: boolean }) {
  const { timeZone } = useSeasonalTheme()
  const { simulation, setSimulation } = useVisitorPreferences()
  const setDate = (value: string) => setSimulation({ ...simulation, dateTime: value || null, dateTimeSetAt: value ? Date.now() : null })
  const update = (next: Partial<typeof simulation>) => setSimulation({ ...simulation, ...next })
  return <section className={`${compact ? 'mt-6 rounded-xl border border-white/10 bg-white/5 p-4' : 'mt-8 border-t border-white/10 pt-5'}`}><h2 className="text-base font-semibold">Simulate your environment</h2><p className="mt-1 text-xs text-white/50">Only affects this visit and resets after refresh.</p><label className="mt-4 block text-xs text-white/60">Perceived time zone<input value={simulation.timeZone ?? ''} onChange={(event) => update({ timeZone: event.target.value || null })} placeholder={`System (${timeZone})`} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white" /></label><label className="mt-3 block text-xs text-white/60">Perceived location<select value={simulation.location} onChange={(event) => update({ location: event.target.value as PerceivedLocation })} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white"><option value="auto">Use time zone</option><option value="australia">Australia</option><option value="outside-australia">Outside Australia</option></select></label><label className="mt-3 block text-xs text-white/60">Perceived date and time<input type="datetime-local" value={simulation.dateTime ? simulation.dateTime.slice(0, 16) : ''} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white" /></label><button onClick={() => setSimulation({ timeZone: null, location: 'auto', dateTime: null, dateTimeSetAt: null })} className="mt-3 text-sm text-white/60 hover:text-white">Use real environment</button></section>
}
