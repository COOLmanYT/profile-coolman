'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AvatarImage from './AvatarImage'
import SpotifyWidget from './SpotifyWidget'
import TwitchWidget from './TwitchWidget'
import DiscordWidget from './DiscordWidget'
import SocialLinks from './SocialLinks'
import YouTubeWidget from './YouTubeWidget'
import SeasonalHat from './SeasonalHat'
import { useVisitorPreferences, type TemporaryFeature } from './VisitorPreferencesProvider'

const LOCATION_TAP_RESET_MS = 6000
const LOCATION_TAP_THRESHOLD = 10

interface ProfileCardProps {
  toggles: Record<string, boolean>
  preview?: boolean
}

export default function ProfileCard({ toggles, preview = false }: ProfileCardProps) {
  const { hiddenModules, hiddenFeatures } = useVisitorPreferences()
  const showFeature = (feature: TemporaryFeature) => preview || !hiddenFeatures.includes(feature)
  const router = useRouter()
  const locationTapCountRef = useRef(0)
  const locationTapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (locationTapResetTimerRef.current) {
      clearTimeout(locationTapResetTimerRef.current)
      locationTapResetTimerRef.current = null
    }
  }, [])

  const onLocationTap = () => {
    locationTapCountRef.current += 1

    if (locationTapResetTimerRef.current) clearTimeout(locationTapResetTimerRef.current)
    locationTapResetTimerRef.current = setTimeout(() => {
      locationTapCountRef.current = 0
      locationTapResetTimerRef.current = null
    }, LOCATION_TAP_RESET_MS)

    if (locationTapCountRef.current >= LOCATION_TAP_THRESHOLD) {
      locationTapCountRef.current = 0
      if (locationTapResetTimerRef.current) {
        clearTimeout(locationTapResetTimerRef.current)
        locationTapResetTimerRef.current = null
      }
      router.push('/dashboard')
    }
  }

  return (
    <div className="relative w-full rounded-3xl shadow-2xl overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#ff0000_0%,#8B0000_100%)]">
      <div className="flex flex-col items-center px-5 sm:px-7 pt-8 sm:pt-9 pb-6 sm:pb-7 gap-4">
        {/* Avatar */}
        <div className="relative h-[88px] w-[88px] flex-shrink-0">
          <div className="h-full w-full overflow-hidden rounded-full ring-4 ring-white/30 shadow-xl [clip-path:circle(50%)]">
            <AvatarImage />
          </div>
          <SeasonalHat />
        </div>

        {/* Username */}
        <div className="text-center -mt-1">
          <h1 className="text-[28px] font-bold text-white tracking-tight leading-tight title-soft-glow">COOLman</h1>
          <p className="text-white/70 text-sm mt-1 leading-snug">just a cool dude making content</p>
        </div>

        {/* Location pill */}
        <button
          type="button"
          onClick={onLocationTap}
          className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10"
          aria-label="Location"
        >
          <span className="text-sm leading-none">&#x1F4CD;</span>
          <span className="text-white/90 text-xs font-medium">lost in my thoughts</span>
        </button>

        {/* Spotify Widget */}
        {toggles.spotify && (preview || !hiddenModules.includes('spotify')) && (
          <SpotifyWidget
            showWidget={(toggles.spotify_widget ?? true) && showFeature('spotify_widget')}
            showPosition={(toggles.spotify_position ?? true) && showFeature('spotify_position')}
            showEmbed={(toggles.spotify_embed ?? true) && showFeature('spotify_embed')}
            showPlaylistLink={(toggles.spotify_playlist ?? true) && showFeature('spotify_playlist')}
            showHistory={(toggles.spotify_history ?? true) && showFeature('spotify_history')}
          />
        )}

        {toggles.twitch && (preview || !hiddenModules.includes('twitch')) && ((toggles.twitch_profile ?? true) || (toggles.twitch_stats ?? true) || (toggles.twitch_live ?? true) || (toggles.twitch_schedule ?? true)) && <TwitchWidget showProfile={(toggles.twitch_profile ?? true) && showFeature('twitch_profile')} showStats={(toggles.twitch_stats ?? true) && showFeature('twitch_stats')} showLive={(toggles.twitch_live ?? true) && showFeature('twitch_live')} showSchedule={(toggles.twitch_schedule ?? true) && showFeature('twitch_schedule')} />}

        {/* Discord Widget */}
        {toggles.discord !== false && (preview || !hiddenModules.includes('discord')) && ((toggles.discord_profile ?? true) || toggles.discord_music || toggles.discord_video || toggles.discord_games || toggles.discord_status || toggles.discord_other) && (
          <DiscordWidget
            showProfile={(toggles.discord_profile ?? true) && showFeature('discord_profile')}
            showBanner={(toggles.discord_banner ?? true) && showFeature('discord_banner')}
            showBadges={(toggles.discord_badges ?? true) && showFeature('discord_badges')}
            showDecoration={(toggles.discord_decoration ?? true) && showFeature('discord_decoration')}
            showDevices={(toggles.discord_devices ?? true) && showFeature('discord_devices')}
            showMusic={toggles.discord_music && showFeature('discord_music')}
            showVideo={toggles.discord_video && showFeature('discord_video')}
            showGames={toggles.discord_games && showFeature('discord_games')}
            showStatus={toggles.discord_status && showFeature('discord_status')}
            showOther={toggles.discord_other && showFeature('discord_other')}
            showMobile={toggles.discord_mobile ?? true}
            showWeb={toggles.discord_web ?? true}
            showDesktop={toggles.discord_desktop ?? true}
          />
        )}

        {toggles.youtube !== false && <YouTubeWidget />}

        {/* Social Links */}
        <SocialLinks />
      </div>
    </div>
  )
}
