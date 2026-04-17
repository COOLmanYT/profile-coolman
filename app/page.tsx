import { createClient } from '@supabase/supabase-js'
import EasterEgg from '@/components/EasterEgg'
import ViewCounter from '@/components/ViewCounter'
import ProfileCard from '@/components/ProfileCard'
import AnimatedBackground from '@/components/AnimatedBackground'

async function getToggles() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return {
      spotify: true,
      spotify_embed: true,
      spotify_playlist: true,
      discord_music: true,
      discord_video: true,
      discord_games: true,
      discord_status: true,
      discord_other: true,
    }
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data } = await supabase.from('toggles').select('id, value')
    const toggleMap: Record<string, boolean> = {
      spotify: true,
      spotify_embed: true,
      spotify_playlist: true,
      discord_music: true,
      discord_video: true,
      discord_games: true,
      discord_status: true,
      discord_other: true,
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
      spotify_embed: true,
      spotify_playlist: true,
      discord_music: true,
      discord_video: true,
      discord_games: true,
      discord_status: true,
      discord_other: true,
    }
  }
}

export default async function Home() {
  const toggles = await getToggles()

  return (
    <>
      <AnimatedBackground />
      <main className="relative min-h-screen flex items-center justify-center p-3 sm:p-4" style={{ zIndex: 10 }}>
        <EasterEgg />
        <div className="relative">
          <ProfileCard toggles={toggles} />
          <ViewCounter />
        </div>
      </main>
    </>
  )
}
