import SeasonalOptionsClient from '@/components/SeasonalOptionsClient'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import { getSeasonalSettings } from '@/lib/site-settings'
import { getLegalSettings } from '@/lib/legal-settings'

export default async function OptionsPage() {
  const [settings, legalSettings] = await Promise.all([getSeasonalSettings(), getLegalSettings()])
  return <SeasonalThemeProvider settings={settings}><SeasonalOptionsClient legalSimpleModeDefault={legalSettings.simpleModeDefault} /></SeasonalThemeProvider>
}
