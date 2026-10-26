import { dashboardAccess, getDashboardMembers } from '@/lib/dashboard-access'
import AccessSettingsClient from '@/components/AccessSettingsClient'
import { siteConfig } from '@/lib/site-config.mjs'
import { getLayoutSettings, getManagedAnnouncement } from '@/lib/dashboard-settings'
import AnnouncementEditor from '@/components/AnnouncementEditor'
import { isModuleAvailable } from '@/lib/site-config.mjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getToggles } from '@/lib/toggles'
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


export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  const access = await dashboardAccess(session)
  if (!access) redirect('/auth/signin')
  const members = access.owner && siteConfig.dashboard.features.accessManagement ? await getDashboardMembers() : []

  const [toggles, twitchHealth, seasonalSettings, legalSettings, layout, announcement] = await Promise.all([getToggles(), getTwitchHealth(), getSeasonalSettings(), getLegalSettings(), getLayoutSettings(), getManagedAnnouncement()])

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <SeasonalThemeProvider settings={seasonalSettings} enabled={toggles.seasons}><div className="bg-[#2a2a2a] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-white text-2xl font-bold">Dashboard</h1>
              <p className="text-white/50 text-sm mt-1">
                Signed in as {session.user?.name ?? 'Unknown'}
              </p>
            </div>
            <DashboardClient initialToggles={toggles} signOutOnly />
          </div>
          <DashboardWorkspace initialToggles={toggles} initialLayout={layout} announcement={announcement} />
          <div className="mt-5 columns-1 gap-4 border-t border-white/10 pt-5 md:columns-2">
            {siteConfig.dashboard.features.announcements && isModuleAvailable('announcement') && siteConfig.announcement.source !== 'lanyard' && <div className="mb-4 break-inside-avoid [&>section]:mt-0"><AnnouncementEditor initialAnnouncement={announcement ?? null} /></div>}
            {isModuleAvailable('seasons') && siteConfig.dashboard.features.seasons && <div className="mb-4 break-inside-avoid [&>section]:mt-0"><SeasonalSettingsClient initialSettings={seasonalSettings} /><details className="mt-3 rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-sm text-white/80">Preview seasonal events</summary><SeasonalSimulationControls compact /><SeasonalPreview /></details></div>}
            {access.owner && siteConfig.dashboard.features.accessManagement && <div className="mb-4 break-inside-avoid [&>section]:mt-0"><AccessSettingsClient initialMembers={members} /></div>}
            <div className="mb-4 break-inside-avoid [&>section]:mt-0"><LegalSettingsClient initialSettings={legalSettings} /></div>
            <div className="mb-4 break-inside-avoid [&>section]:mt-0"><ProviderHealthClient /></div>
            {access.owner && isModuleAvailable('twitch') && <section className="mb-4 break-inside-avoid [&>section]:mt-0 rounded-xl border border-white/10 bg-white/5 p-4"><TwitchConnectionStatus health={twitchHealth} /><a href="/api/twitch/connect" className="mt-3 flex items-center justify-center rounded-lg bg-[#9146ff] px-3 py-2 text-sm font-semibold text-white">{twitchHealth.state === 'connected' ? 'Reconnect Twitch' : 'Connect Twitch'}</a></section>}
            <section className="mb-4 break-inside-avoid [&>section]:mt-0 rounded-xl border border-white/10 bg-white/5 p-4"><h2 className="text-sm font-semibold text-white">Backgrounds and configuration</h2><p className="mt-1 text-xs text-white/50">Examples for colours, animations, images, GIFs and videos.</p><a href="/backgrounds" className="mt-3 inline-block text-sm font-semibold text-red-200 underline">Open background guide →</a></section>
          </div>
        </div></SeasonalThemeProvider>
      </div>
    </div>
  )
}
