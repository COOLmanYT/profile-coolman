import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import DashboardClient from '@/components/DashboardClient'

const ALLOWED_DISCORD_ID = process.env.DISCORD_USER_ID

async function getToggles() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) {
    return {
      spotify: true,
      spotify_embed: true,
      discord_music: true,
      discord_video: true,
      discord_games: true,
      discord_status: true,
      discord_other: true,
    }
  }
  try {
    const supabase = createClient(url, key)
    const { data } = await supabase.from('toggles').select('id, value')
    const defaults: Record<string, boolean> = {
      spotify: true,
      spotify_embed: true,
      discord_music: true,
      discord_video: true,
      discord_games: true,
      discord_status: true,
      discord_other: true,
    }
    if (data) {
      data.forEach((row: { id: string; value: boolean }) => {
        defaults[row.id] = row.value
      })
    }
    return defaults
  } catch {
    return {
      spotify: true,
      spotify_embed: true,
      discord_music: true,
      discord_video: true,
      discord_games: true,
      discord_status: true,
      discord_other: true,
    }
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  const userId = (session.user as { id?: string })?.id
  if (!userId || !ALLOWED_DISCORD_ID || userId !== ALLOWED_DISCORD_ID) {
    redirect('/auth/signin')
  }

  const toggles = await getToggles()

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-8">
      <div className="max-w-lg mx-auto">
        <div className="bg-[#2a2a2a] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-white text-2xl font-bold">Dashboard</h1>
              <p className="text-white/50 text-sm mt-1">
                Signed in as {session.user?.name ?? 'Unknown'}
              </p>
            </div>
            <DashboardClient initialToggles={toggles} signOutOnly />
          </div>
          <DashboardClient initialToggles={toggles} />
        </div>
      </div>
    </div>
  )
}
