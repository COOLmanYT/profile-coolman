'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SEASONAL_THEMES, type SeasonalTheme } from '@/lib/seasonal'
import { useSeasonalTheme } from './SeasonalThemeProvider'
import { useVisitorPreferences, type PerceivedLocation, type TemporaryFeature, type TemporaryModule } from './VisitorPreferencesProvider'

const LABELS: Record<SeasonalTheme, string> = {
  christmas: 'Christmas',
  halloween: 'Halloween',
  easter: 'Easter',
  'new-year': 'New Year',
  birthday: 'Birthday',
}

const LEGAL_SIMPLE_MODE_KEY = 'coolman-legal-simple-mode'
const TEMPORARY_FEATURES: Array<{ category: string; id: TemporaryFeature; label: string }> = [
  { category: 'Spotify', id: 'spotify_widget', label: 'Now-playing widget' },
  { category: 'Spotify', id: 'spotify_position', label: 'Player position and duration' },
  { category: 'Spotify', id: 'spotify_embed', label: 'Embed player' },
  { category: 'Spotify', id: 'spotify_playlist', label: 'Playlist link' },
  { category: 'Spotify', id: 'spotify_history', label: 'Listening history' },
  { category: 'Twitch', id: 'twitch_profile', label: 'Channel profile and live status' },
  { category: 'Twitch', id: 'twitch_stats', label: 'Follower and subscriber totals' },
  { category: 'Twitch', id: 'twitch_live', label: 'Live stream widget' },
  { category: 'Twitch', id: 'twitch_schedule', label: 'Next scheduled stream' },
  { category: 'Discord', id: 'discord_profile', label: 'Profile and presence status' },
  { category: 'Discord', id: 'discord_banner', label: 'Profile banner' },
  { category: 'Discord', id: 'discord_badges', label: 'Badges' },
  { category: 'Discord', id: 'discord_decoration', label: 'Avatar decoration and nameplate' },
  { category: 'Discord', id: 'discord_devices', label: 'Device presence' },
  { category: 'Discord', id: 'discord_status', label: 'Custom status' },
  { category: 'Discord', id: 'discord_music', label: 'Music activity' },
  { category: 'Discord', id: 'discord_video', label: 'Video activity' },
  { category: 'Discord', id: 'discord_games', label: 'Game activity' },
  { category: 'Discord', id: 'discord_other', label: 'Other activity' },
]

export default function SeasonalOptionsClient({ legalSimpleModeDefault }: { legalSimpleModeDefault: boolean }) {
  const { preference, setPreference, activateOnce, clearOnce, timeZone } = useSeasonalTheme()
  const { simulation, setSimulation, hiddenModules, setModuleHidden, hiddenFeatures, setFeatureHidden } = useVisitorPreferences()
  const [theme, setTheme] = useState<SeasonalTheme | ''>(preference.theme ?? 'christmas')
  const [until, setUntil] = useState(preference.until ? preference.until.slice(0, 16) : '')
  const [legalSimpleMode, setLegalSimpleMode] = useState<'default' | 'simple' | 'standard'>('default')

  useEffect(() => {
    const saved = window.localStorage.getItem(LEGAL_SIMPLE_MODE_KEY)
    if (saved === 'true') setLegalSimpleMode('simple')
    if (saved === 'false') setLegalSimpleMode('standard')
  }, [])

  const saveUntil = () => {
    if (!until || !theme) return
    setPreference({ theme, until: new Date(until).toISOString() })
  }
  const setSimulatedDate = (value: string) => setSimulation({ ...simulation, dateTime: value || null, dateTimeSetAt: value ? Date.now() : null })
  const setLocation = (location: PerceivedLocation) => setSimulation({ ...simulation, location })
  const setTimeZone = (value: string) => setSimulation({ ...simulation, timeZone: value || null })
  const updateLegalSimpleMode = (value: 'default' | 'simple' | 'standard') => {
    setLegalSimpleMode(value)
    if (value === 'default') window.localStorage.removeItem(LEGAL_SIMPLE_MODE_KEY)
    else window.localStorage.setItem(LEGAL_SIMPLE_MODE_KEY, String(value === 'simple'))
  }

  return (
    <div className="min-h-screen bg-[#151515] px-5 py-10 text-white">
      <main className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-5">
        <Link href="/" className="text-xs text-white/45 hover:text-white">← Back to profile</Link>
        <h1 className="mt-4 text-2xl font-bold">Seasonal Options</h1>
        <p className="mt-1 text-sm text-white/55">Automatic dates use your browser time zone: {timeZone}.</p>
        <label className="mt-6 block text-sm font-medium">Theme</label>
        <select value={theme} onChange={(event) => { const next = event.target.value as SeasonalTheme | ''; setTheme(next); if (!next) clearOnce() }} className="mt-2 w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm">
          <option value="">None</option>
          {SEASONAL_THEMES.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}
        </select>
        <div className="mt-4 grid gap-2">
          <button onClick={() => theme ? activateOnce(theme) : clearOnce()} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">{theme ? 'Turn on once for this visit' : 'Turn off one-visit theme'}</button>
          <button onClick={clearOnce} className="text-sm text-white/60 hover:text-white">Turn off one-visit theme / select None</button>
          <label className="rounded-lg border border-white/10 p-3 text-sm">
            Turn on until a date and time
            <input type="datetime-local" value={until} onChange={(event) => setUntil(event.target.value)} className="mt-2 w-full rounded bg-black/25 px-2 py-1.5 text-white" />
          </label>
          <button onClick={saveUntil} disabled={!until || !theme} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold enabled:hover:bg-red-500 disabled:opacity-40">Save timed theme</button>
          <button onClick={() => { setPreference({ theme: null, until: null }); setUntil('') }} className="text-sm text-white/60 hover:text-white">Use automatic settings</button>
        </div>
        <section className="mt-8 border-t border-white/10 pt-5">
          <h2 className="text-base font-semibold">Simulate your environment</h2>
          <p className="mt-1 text-xs text-white/50">Only affects this visit and resets after refresh.</p>
          <label className="mt-4 block text-xs text-white/60">Perceived time zone
            <input value={simulation.timeZone ?? ''} onChange={(event) => setTimeZone(event.target.value)} placeholder={`System (${timeZone})`} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white" />
          </label>
          <label className="mt-3 block text-xs text-white/60">Perceived location
            <select value={simulation.location} onChange={(event) => setLocation(event.target.value as PerceivedLocation)} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white">
              <option value="auto">Use time zone</option><option value="australia">Australia</option><option value="outside-australia">Outside Australia</option>
            </select>
          </label>
          <label className="mt-3 block text-xs text-white/60">Perceived date and time
            <input type="datetime-local" value={simulation.dateTime ? simulation.dateTime.slice(0, 16) : ''} onChange={(event) => setSimulatedDate(event.target.value)} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white" />
          </label>
          <button onClick={() => setSimulation({ timeZone: null, location: 'auto', dateTime: null, dateTimeSetAt: null })} className="mt-3 text-sm text-white/60 hover:text-white">Use real environment</button>
        </section>
        <section className="mt-8 border-t border-white/10 pt-5">
          <h2 className="text-base font-semibold">Hide modules for this visit</h2>
          <p className="mt-1 text-xs text-white/50">These only affect your browser and clear after refresh.</p>
          {([['spotify', 'Spotify listening'], ['twitch', 'Twitch presence'], ['discord', 'Discord presence']] as [TemporaryModule, string][]).map(([module, label]) => (
            <label key={module} className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><span>{label}</span><input type="checkbox" checked={hiddenModules.includes(module)} onChange={(event) => setModuleHidden(module, event.target.checked)} className="h-4 w-4 accent-red-600" /></label>
          ))}
        </section>
        <section className="mt-8 border-t border-white/10 pt-5">
          <h2 className="text-base font-semibold">Hide module features for this visit</h2>
          <p className="mt-1 text-xs text-white/50">Fine-tune what you see without changing the Dashboard. These settings clear after refresh.</p>
          {(['Spotify', 'Twitch', 'Discord'] as const).map((category) => (
            <div key={category} className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">{category}</h3><div className="mt-2 space-y-2">{TEMPORARY_FEATURES.filter((feature) => feature.category === category).map((feature) => (
              <label key={feature.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><span>{feature.label}</span><input type="checkbox" checked={hiddenFeatures.includes(feature.id)} onChange={(event) => setFeatureHidden(feature.id, event.target.checked)} className="h-4 w-4 accent-red-600" /></label>
            ))}</div></div>
          ))}
        </section>
        <section className="mt-8 border-t border-white/10 pt-5">
          <h2 className="text-base font-semibold">Legal page reading mode</h2>
          <p className="mt-1 text-xs text-white/50">Choose your default for the Terms and Privacy Policy. This is stored only in this browser.</p>
          <select value={legalSimpleMode} onChange={(event) => updateLegalSimpleMode(event.target.value as 'default' | 'simple' | 'standard')} className="mt-3 w-full rounded bg-black/25 px-2 py-2 text-sm text-white">
            <option value="default">Use site default ({legalSimpleModeDefault ? 'Simple Mode' : 'standard language'})</option>
            <option value="simple">Always use Simple Mode</option>
            <option value="standard">Always use standard language</option>
          </select>
          <div className="mt-3 flex gap-3 text-sm text-white/60"><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></div>
        </section>
      </main>
    </div>
  )
}
