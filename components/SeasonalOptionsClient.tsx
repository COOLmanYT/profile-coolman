'use client'

import { DASHBOARD_LABELS } from '@/lib/dashboard-controls.mjs'

import { configuredGroups, isControlAvailable, isModuleAvailable } from '@/lib/site-config.mjs'
import { ColorModeControl } from './ColorModeProvider'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SEASONAL_THEMES, type SeasonalTheme } from '@/lib/seasonal'
import { useSeasonalTheme } from './SeasonalThemeProvider'
import { useVisitorPreferences, type TemporaryFeature, type TemporaryModule } from './VisitorPreferencesProvider'
import SeasonalPreview from './SeasonalPreview'
import SeasonalSimulationControls from './SeasonalSimulationControls'
import { useToast } from './ToastProvider'

const LABELS: Record<SeasonalTheme, string> = {
  christmas: 'Christmas',
  halloween: 'Halloween',
  easter: 'Easter',
  'new-year': 'New Year',
  birthday: 'Birthday',
}

const LEGAL_SIMPLE_MODE_KEY = 'coolman-legal-simple-mode'
const GROUPS = configuredGroups()
const TEMPORARY_FEATURES = GROUPS.flatMap(({ title, parentKey, keys }) => keys.filter((key) => key !== parentKey).map((id) => ({ category: title, id: id as TemporaryFeature, label: DASHBOARD_LABELS[id] })))

export default function SeasonalOptionsClient({ legalSimpleModeDefault, youtubeEmbedDefault = false }: { legalSimpleModeDefault: boolean; youtubeEmbedDefault?: boolean }) {
  const { showToast } = useToast()
  const { preference, setPreference, activateOnce, clearOnce, timeZone } = useSeasonalTheme()
  const { hiddenModules, setModuleHidden, hiddenFeatures, setFeatureHidden, mediaPreferences, setMediaPreferences, resetPreferences } = useVisitorPreferences()
  const [theme, setTheme] = useState<SeasonalTheme | ''>(preference.theme ?? 'christmas')
  const [until, setUntil] = useState(preference.until ? preference.until.slice(0, 16) : '')
  const [legalSimpleMode, setLegalSimpleMode] = useState<'default' | 'simple' | 'standard'>('default')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LEGAL_SIMPLE_MODE_KEY)
      if (saved === 'true') setLegalSimpleMode('simple')
      if (saved === 'false') setLegalSimpleMode('standard')
    } catch { /* Storage is optional. */ }
  }, [])

  const saveUntil = () => {
    if (!until || !theme) return
    setPreference({ theme, until: new Date(until).toISOString() })
    showToast({ variant: 'success', title: 'Timed theme saved' })
  }
  const updateLegalSimpleMode = (value: 'default' | 'simple' | 'standard') => {
    setLegalSimpleMode(value)
    if (value === 'default') window.localStorage.removeItem(LEGAL_SIMPLE_MODE_KEY)
    else window.localStorage.setItem(LEGAL_SIMPLE_MODE_KEY, String(value === 'simple'))
    showToast({ variant: 'success', title: 'Legal reading preference saved' })
  }
  const updateModule = (module: TemporaryModule, hidden: boolean) => { setModuleHidden(module, hidden); showToast({ variant: 'success', title: `${module} ${hidden ? 'hidden' : 'shown'} in this browser` }) }
  const updateFeature = (feature: TemporaryFeature, hidden: boolean) => { setFeatureHidden(feature, hidden); showToast({ variant: 'success', title: `${feature.replaceAll('_', ' ')} ${hidden ? 'hidden' : 'shown'} in this browser` }) }
  const updateMedia = (next: typeof mediaPreferences, title: string) => { setMediaPreferences(next); showToast({ variant: 'success', title }) }

  return (
    <div className="min-h-screen bg-[#151515] px-5 py-10 text-white">
      <main className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-5">
        <Link href="/" className="text-xs text-white/45 hover:text-white">← Back to profile</Link>
        <h1 className="mt-4 text-2xl font-bold">Options</h1>
        <ColorModeControl />
        <button onClick={() => { resetPreferences(); window.location.reload() }} className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10">Reset to default</button>
        <p className="mt-1 text-[11px] text-white/45">Resets your browser preferences, including hidden modules, features, media, themes and reading mode.</p>
        {isModuleAvailable('seasons') && <>
        <p className="mt-1 text-sm text-white/55">Automatic dates use your browser time zone: {timeZone}.</p>
        <label className="mt-6 block text-sm font-medium">Theme</label>
        <select value={theme} onChange={(event) => { const next = event.target.value as SeasonalTheme | ''; setTheme(next); if (!next) clearOnce() }} className="mt-2 w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm">
          <option value="">None</option>
          {SEASONAL_THEMES.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}
        </select>
        <div className="mt-4 grid gap-2">
          <button onClick={() => { if (theme) { activateOnce(theme); showToast({ variant: 'success', title: `${LABELS[theme]} enabled for this visit` }) } else { clearOnce(); showToast({ variant: 'success', title: 'One-visit theme turned off' }) } }} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">{theme ? 'Turn on once for this visit' : 'Turn off one-visit theme'}</button>
          <button onClick={() => { clearOnce(); showToast({ variant: 'success', title: 'One-visit theme turned off' }) }} className="text-sm text-white/60 hover:text-white">Turn off one-visit theme / select None</button>
          <label className="rounded-lg border border-white/10 p-3 text-sm">
            Turn on until a date and time
            <input type="datetime-local" value={until} onChange={(event) => setUntil(event.target.value)} className="mt-2 w-full rounded bg-black/25 px-2 py-1.5 text-white" />
          </label>
          <button onClick={saveUntil} disabled={!until || !theme} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold enabled:hover:bg-red-500 disabled:opacity-40">Save timed theme</button>
          <button onClick={() => { setPreference({ theme: null, until: null }); setUntil(''); showToast({ variant: 'success', title: 'Automatic theme settings restored' }) }} className="text-sm text-white/60 hover:text-white">Use automatic settings</button>
        </div>
        <SeasonalSimulationControls />
        <SeasonalPreview />
        </>}
        <section className="mt-8 border-t border-white/10 pt-5">
          <h2 className="text-base font-semibold">Hide modules</h2>
          <p className="mt-1 text-xs text-white/50">Saved in this browser, including after refresh. Dashboard settings still take priority.</p>
          {GROUPS.filter(({ parentKey }) => !['analytics', 'seasons', 'easterEgg'].includes(parentKey)).map(({ parentKey: module, title: label }) => (
            <label key={module} className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><span>{label}</span><input type="checkbox" checked={hiddenModules.includes(module)} onChange={(event) => updateModule(module, event.target.checked)} className="h-4 w-4 accent-red-600" /></label>
          ))}
        </section>
        <section className="mt-8 border-t border-white/10 pt-5">
          <h2 className="text-base font-semibold">Media preferences</h2>
          <p className="mt-1 text-xs text-white/50">Saved only in this browser. Global Dashboard settings take priority.</p>
          {([
            ['showYoutube', 'Show YouTube widget'],
            ['showYoutubeStats', 'Show channel stats and last upload date'],
            ['showLatestUpload', 'Show latest upload (Shorts, videos and streams)'],
            ['showYoutubeLive', 'Show YouTube live status'],
          ] as const).filter(([key]) => isControlAvailable(({ showYoutube: 'youtube', showYoutubeStats: 'youtube_stats', showLatestUpload: 'youtube_latest', showYoutubeLive: 'youtube_live' })[key])).map(([key, label]) => <label key={key} className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm"><span>{label}</span><input type="checkbox" checked={mediaPreferences[key]} onChange={(event) => updateMedia({ ...mediaPreferences, [key]: event.target.checked }, `${label}: ${event.target.checked ? 'on' : 'off'}`)} className="h-4 w-4 shrink-0 accent-red-600" /></label>)}
          {isControlAvailable('youtube_shorts') && isControlAvailable('youtube_videos') && <label className="mt-4 block text-xs text-white/60">YouTube uploads<select value={mediaPreferences.youtubeFormat} onChange={(event) => updateMedia({ ...mediaPreferences, youtubeFormat: event.target.value as typeof mediaPreferences.youtubeFormat }, 'YouTube upload preference saved')} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white"><option value="both">Shorts and videos</option><option value="shorts">Shorts only</option><option value="videos">Videos only</option></select></label>}
          {isControlAvailable('youtube_embed_default') && <label className="mt-4 block text-xs text-white/60">Try the playable YouTube embed<select value={mediaPreferences.youtubeEmbed} onChange={(event) => updateMedia({ ...mediaPreferences, youtubeEmbed: event.target.value as typeof mediaPreferences.youtubeEmbed }, 'YouTube embed preference saved')} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white"><option value="default">Use site default ({youtubeEmbedDefault ? 'on' : 'off'})</option><option value="on">On</option><option value="off">Off</option></select></label>}
          <p className="mt-1 text-[11px] text-white/45">When on, the player connects to YouTube. Some videos cannot play embedded; a watch link stays available.</p>
          {isControlAvailable('twitch_schedule') && <label className="mt-4 block text-xs text-white/60">Twitch schedule time zone<select value={mediaPreferences.scheduleTimeZone ?? ''} onChange={(event) => updateMedia({ ...mediaPreferences, scheduleTimeZone: event.target.value || null }, 'Twitch schedule time zone saved')} className="mt-1 w-full rounded bg-black/25 px-2 py-2 text-sm text-white"><option value="">Use your local time zone</option><option value="Australia/Sydney">Australia/Sydney</option><option value="UTC">UTC</option><option value="America/Los_Angeles">America/Los Angeles</option><option value="America/New_York">America/New York</option><option value="Europe/London">Europe/London</option></select></label>}
        </section>
        <section className="mt-8 border-t border-white/10 pt-5">
          <h2 className="text-base font-semibold">Hide module features</h2>
          <p className="mt-1 text-xs text-white/50">Fine-tune what you see. These settings are saved in this browser.</p>
          {[...new Set(TEMPORARY_FEATURES.map(({ category }) => category))].map((category) => (
            <div key={category} className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">{category}</h3><div className="mt-2 space-y-2">{TEMPORARY_FEATURES.filter((feature) => feature.category === category).map((feature) => (
              <label key={feature.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><span>{feature.label}</span><input type="checkbox" checked={hiddenFeatures.includes(feature.id)} onChange={(event) => updateFeature(feature.id, event.target.checked)} className="h-4 w-4 accent-red-600" /></label>
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
