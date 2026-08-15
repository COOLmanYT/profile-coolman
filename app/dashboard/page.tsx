import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/DashboardClient'
import DashboardWorkspace from '@/components/DashboardWorkspace'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import TwitchConnectionStatus from '@/components/TwitchConnectionStatus'
import { getTwitchHealth } from '@/lib/twitch'
import SeasonalSettingsClient from '@/components/SeasonalSettingsClient'
import { getSeasonalSettings } from '@/lib/site-settings'
import LegalSettingsClient from '@/components/LegalSettingsClient'
import { getLegalSettings } from '@/lib/legal-settings'
import SeasonalPreview from '@/components/SeasonalPreview'
import SeasonalSimulationControls from '@/components/SeasonalSimulationControls'
import ProviderHealthClient from '@/components/ProviderHealthClient'
import { getToggles } from '@/lib/toggles'

const ALLOWED_DISCORD_ID = process.env.DISCORD_USER_ID

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  const userId = (session.user as { id?: string })?.id
  if (!userId || !ALLOWED_DISCORD_ID || userId !== ALLOWED_DISCORD_ID) {
    redirect('/auth/signin')
  }

  const [toggles, twitchHealth, seasonalSettings, legalSettings] = await Promise.all([getToggles(), getTwitchHealth(), getSeasonalSettings(), getLegalSettings()])

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-8">
      <div className="max-w-lg mx-auto">
        <SeasonalThemeProvider settings={seasonalSettings}><div className="bg-[#2a2a2a] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-white text-2xl font-bold">Dashboard</h1>
              <p className="text-white/50 text-sm mt-1">
                Signed in as {session.user?.name ?? 'Unknown'}
              </p>
            </div>
            <DashboardClient initialToggles={toggles} signOutOnly />
          </div>
          <DashboardWorkspace initialToggles={toggles} />
          <SeasonalSettingsClient initialSettings={seasonalSettings} />
          <SeasonalSimulationControls compact />
          <SeasonalPreview />
          <LegalSettingsClient initialSettings={legalSettings} />
          <ProviderHealthClient />
          <TwitchConnectionStatus health={twitchHealth} />
          <a
            href="/api/twitch/connect"
            className="mt-6 flex items-center justify-center rounded-xl bg-[#9146ff] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#7c36e1]"
          >
            {twitchHealth.state === 'connected' ? 'Reconnect Twitch' : 'Connect Twitch'}
          </a>
        </div></SeasonalThemeProvider>
      </div>
    </div>
  )
}
