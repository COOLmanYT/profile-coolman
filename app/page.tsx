import { createClient } from '@supabase/supabase-js'
import EasterEgg from '@/components/EasterEgg'
import ViewCounter from '@/components/ViewCounter'
import ProfileCard from '@/components/ProfileCard'
import AnimatedBackground from '@/components/AnimatedBackground'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import SeasonalEffects from '@/components/SeasonalEffects'
import { getSeasonalSettings } from '@/lib/site-settings'
import Link from 'next/link'
import ShareCard from '@/components/ShareCard'

async function getToggles() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return {
      spotify: true,
      spotify_widget: true,
      spotify_embed: true,
      spotify_playlist: true,
      spotify_history: true,
      twitch: true,
      twitch_profile: true,
      twitch_stats: true,
      twitch_live: true,
      discord: true,
      discord_profile: true,
      discord_banner: true,
      discord_badges: true,
      discord_devices: true,
      discord_music: true,
      discord_video: true,
      discord_games: true,
      discord_status: true,
      discord_other: true,
      discord_mobile: true,
      discord_web: true,
      discord_desktop: true,
    }
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data } = await supabase.from('toggles').select('id, value')
    const toggleMap: Record<string, boolean> = {
      spotify: true,
      spotify_widget: true,
      spotify_embed: true,
      spotify_playlist: true,
      spotify_history: true,
      twitch: true,
      twitch_profile: true,
      twitch_stats: true,
      twitch_live: true,
      discord: true,
      discord_profile: true,
      discord_banner: true,
      discord_badges: true,
      discord_devices: true,
      discord_music: true,
      discord_video: true,
      discord_games: true,
      discord_status: true,
      discord_other: true,
      discord_mobile: true,
      discord_web: true,
      discord_desktop: true,
    }
    if (data) {
      data.forEach((row: { id: string; value: boolean }) => {
        toggleMap[row.id] = row.value
      })
    }
    return toggleMap
  } catch {
    return {
      spotify: true,
      spotify_widget: true,
      spotify_embed: true,
      spotify_playlist: true,
      spotify_history: true,
      twitch: true,
      twitch_profile: true,
      twitch_stats: true,
      twitch_live: true,
      discord: true,
      discord_profile: true,
      discord_banner: true,
      discord_badges: true,
      discord_devices: true,
      discord_music: true,
      discord_video: true,
      discord_games: true,
      discord_status: true,
      discord_other: true,
      discord_mobile: true,
      discord_web: true,
      discord_desktop: true,
    }
  }
}

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
        </footer>
      </main>
    </SeasonalThemeProvider>
  )
}
