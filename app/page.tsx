import { getLayoutSettings, getManagedAnnouncement } from '@/lib/dashboard-settings'
import VisitorModule from '@/components/VisitorModule'
import EasterEgg from '@/components/EasterEgg'
import ViewCounter from '@/components/ViewCounter'
import ProfileCard from '@/components/ProfileCard'
import AnimatedBackground from '@/components/AnimatedBackground'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import SeasonalEffects from '@/components/SeasonalEffects'
import { getToggles } from '@/lib/toggles'
import { getSeasonalSettings } from '@/lib/site-settings'
import Link from 'next/link'
import ShareCard from '@/components/ShareCard'
import StatusWidget from '@/components/StatusWidget'
import LikeCounter from '@/components/LikeCounter'
export default async function Home() {
  const [toggles, seasonalSettings, layout, announcement] = await Promise.all([getToggles(), getSeasonalSettings(), getLayoutSettings(), getManagedAnnouncement()])
  return (
    <SeasonalThemeProvider settings={seasonalSettings} enabled={toggles.seasons}>
      <AnimatedBackground />
      <main className="relative flex min-h-screen flex-col items-center justify-center px-3 pb-16 pt-6 sm:px-4 sm:py-8" style={{ zIndex: 10 }}>
        {toggles.easterEgg && <EasterEgg />}
        {toggles.seasons && <SeasonalEffects />}
        <div className="relative w-full max-w-[390px] lg:max-w-[460px]">
          <ProfileCard toggles={toggles} layout={layout} announcement={announcement} />
          {toggles.status && <VisitorModule id="status"><StatusWidget /></VisitorModule>}
          <div className="mt-4 flex min-h-8 items-center justify-between gap-4 px-1">
            {toggles.views && <VisitorModule id="views"><ViewCounter /></VisitorModule>}
            {toggles.likes && <VisitorModule id="likes"><LikeCounter /></VisitorModule>}
          </div>
        </div>
        <footer className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/35">
          <Link href="/options" className="transition-colors hover:text-white/80">Options</Link>
          <Link href="/dashboard" className="transition-colors hover:text-white/80">Dashboard</Link>
          {toggles.share && <VisitorModule id="share"><ShareCard /></VisitorModule>}
          <Link href="/terms" className="transition-colors hover:text-white/80">Terms</Link>
          <Link href="/privacy" className="transition-colors hover:text-white/80">Privacy</Link>
          <Link href="/licence" className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-medium text-white/60 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white">⚖ Licence</Link>
          <Link href="/changelog" className="transition-colors hover:text-white/80">Changelog</Link>
        </footer>
      </main>
    </SeasonalThemeProvider>
  )
}
