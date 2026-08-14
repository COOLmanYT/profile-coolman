import SeasonalOptionsClient from '@/components/SeasonalOptionsClient'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import { getSeasonalSettings } from '@/lib/site-settings'

export default async function OptionsPage() {
  const settings = await getSeasonalSettings()
  return <SeasonalThemeProvider settings={settings}><SeasonalOptionsClient /></SeasonalThemeProvider>
}
