import EasterEgg from '@/components/EasterEgg'
import ViewCounter from '@/components/ViewCounter'
import ProfileCard from '@/components/ProfileCard'
import AnimatedBackground from '@/components/AnimatedBackground'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import SeasonalEffects from '@/components/SeasonalEffects'
import { getSeasonalSettings } from '@/lib/site-settings'
import { getToggles } from '@/lib/toggles'
import Link from 'next/link'
import ShareCard from '@/components/ShareCard'
import StatusWidget from '@/components/StatusWidget'

export default async function Home() {
  const [toggles, seasonalSettings] = await Promise.all([getToggles(), getSeasonalSettings()])

  return (
    <SeasonalThemeProvider settings={seasonalSettings}>
      <AnimatedBackground />
      <main className="relative flex min-h-screen flex-col items-center justify-center px-3 pb-16 pt-6 sm:px-4 sm:py-8" style={{ zIndex: 10 }}>
        <EasterEgg />
        <SeasonalEffects />
        <div className="relative w-full max-w-[390px] lg:max-w-[460px]">
          <ProfileCard toggles={toggles} />
          <ViewCounter />
          <StatusWidget />
        </div>
        <footer className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/35">
          <Link href="/options" className="transition-colors hover:text-white/80">Options</Link>
          <span aria-hidden>•</span>
          <Link href="/dashboard" className="transition-colors hover:text-white/80">Dashboard</Link>
          <span aria-hidden>•</span>
          <ShareCard />
          <span aria-hidden>•</span>
          <Link href="/terms" className="transition-colors hover:text-white/80">Terms</Link>
          <span aria-hidden>•</span>
          <Link href="/privacy" className="transition-colors hover:text-white/80">Privacy</Link>
          <span aria-hidden>•</span>
          <Link href="/licence" className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-medium text-white/60 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white">⚖ Licence</Link>
          <span aria-hidden>•</span>
          <Link href="/changelog" className="transition-colors hover:text-white/80">Changelog</Link>
        </footer>
      </main>
    </SeasonalThemeProvider>
  )
}
