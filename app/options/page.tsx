import SeasonalOptionsClient from '@/components/SeasonalOptionsClient'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import { getSeasonalSettings } from '@/lib/site-settings'
import { getLegalSettings } from '@/lib/legal-settings'
import { getToggles } from '@/lib/toggles'

export default async function OptionsPage() {
  const [settings, legalSettings, toggles] = await Promise.all([getSeasonalSettings(), getLegalSettings(), getToggles()])
  return <SeasonalThemeProvider settings={settings} enabled={toggles.seasons}><SeasonalOptionsClient legalSimpleModeDefault={legalSettings.simpleModeDefault} youtubeEmbedDefault={toggles.youtube_embed_default ?? false} /></SeasonalThemeProvider>
}
