'use client'

import { siteConfig, applyModulePolicy, isControlAvailable, isModuleAvailable } from '@/lib/site-config.mjs'
import type { ReactNode } from 'react'
import FeatureLayout, { LayoutOrderProvider, type LayoutSettings } from './FeatureLayout'
import { normaliseLayout } from '@/lib/layout-order.mjs'
import type { Announcement } from '@/lib/dashboard-settings'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AvatarImage from './AvatarImage'
import SpotifyWidget from './SpotifyWidget'
import TwitchWidget from './TwitchWidget'
import DiscordWidget from './DiscordWidget'
import SocialLinks from './SocialLinks'
import YouTubeWidget from './YouTubeWidget'
import CommunityWidget from './CommunityWidget'
import BuyMeACoffeeWidget from './BuyMeACoffeeWidget'
import SeasonalHat from './SeasonalHat'
import GithubWidget from './GithubWidget'
import LiveAnnouncement from './LiveAnnouncement'
import StreamTakeover from './StreamTakeover'
import { useTwitchPresence } from '@/lib/use-twitch-presence'
import { useVisitorPreferences, type TemporaryFeature } from './VisitorPreferencesProvider'

const LOCATION_TAP_RESET_MS = 6000
const LOCATION_TAP_THRESHOLD = 10

interface ProfileCardProps {
  toggles: Record<string, boolean>
  preview?: boolean
  layout?: LayoutSettings
  announcement?: Announcement | null
}

export default function ProfileCard({ toggles: savedToggles, preview = false, layout = normaliseLayout(null), announcement }: ProfileCardProps) {
  const toggles = applyModulePolicy(savedToggles)
  const { visibilityLoaded, hiddenModules, hiddenFeatures, mediaPreferences } = useVisitorPreferences()
  const showFeature = (feature: TemporaryFeature) => isControlAvailable(feature) && (preview || !hiddenFeatures.includes(feature))
  const communityVisible = Object.fromEntries(Object.entries(toggles).map(([key, enabled]) => [key, enabled && showFeature(key)]))
  const githubVisibility = {
    showStatus: (toggles.github_status ?? true) && showFeature('github_status'),
    showProfile: (toggles.github_profile ?? true) && showFeature('github_profile'),
    showStats: (toggles.github_stats ?? true) && showFeature('github_stats'),
    showCommitCount: (toggles.github_commits ?? true) && showFeature('github_commits'),
    showGraph: (toggles.github_graph ?? true) && showFeature('github_graph'),
    showProjects: (toggles.github_projects ?? true) && showFeature('github_projects'),
    showCommitTitles: (toggles.github_commit_titles ?? true) && showFeature('github_commit_titles'),
    showLanguage: (toggles.github_language ?? true) && showFeature('github_language'),
    showLicence: (toggles.github_licence ?? true) && showFeature('github_licence'),
  }
  const showGithub = (preview || visibilityLoaded) && (toggles.github ?? true) && (preview || !hiddenModules.includes('github'))
    && (githubVisibility.showStatus || githubVisibility.showProfile || githubVisibility.showStats || githubVisibility.showCommitCount || githubVisibility.showGraph || githubVisibility.showProjects)
  const showTwitch = (preview || visibilityLoaded) && toggles.twitch && (preview || !hiddenModules.includes('twitch'))
  const showTwitchProfile = (toggles.twitch_profile ?? true) && showFeature('twitch_profile')
  const showTwitchStats = (toggles.twitch_stats ?? true) && showFeature('twitch_stats')
  const showTwitchLive = (toggles.twitch_live ?? true) && showFeature('twitch_live')
  const showTwitchSchedule = (toggles.twitch_schedule ?? true) && showFeature('twitch_schedule')
  const twitchEnabled = showTwitch && (showTwitchProfile || showTwitchStats || showTwitchLive || showTwitchSchedule)
  const twitch = useTwitchPresence(twitchEnabled)
  const takeover = showTwitch && showTwitchLive && (toggles.twitch_takeover ?? true) && showFeature('twitch_takeover') && !twitch.isUnavailable && twitch.presence?.isLive
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

  const modules: Record<string, ReactNode> = {
    profile: <FeatureLayout module="profile">
        {/* Avatar */}
        {toggles.profile && (preview || !hiddenModules.includes('profile')) && toggles.profile_avatar && showFeature('profile_avatar') && <div data-feature="profile_avatar" className="relative h-[88px] w-[88px] flex-shrink-0">
          <div className="h-full w-full overflow-hidden rounded-full ring-4 ring-white/30 shadow-xl [clip-path:circle(50%)]">
            <AvatarImage />
          </div>
          {toggles.seasons && <SeasonalHat />}
        </div>}

        {/* Username */}
        <div data-feature="profile_bio" className="text-center -mt-1">
          <h1 className="text-[28px] font-bold text-white tracking-tight leading-tight title-soft-glow">{siteConfig.profile.username}</h1>
          {toggles.profile && (preview || !hiddenModules.includes('profile')) && toggles.profile_bio && showFeature('profile_bio') && <p data-feature="profile_bio" className="text-white/70 text-sm mt-1 leading-snug">{siteConfig.profile.bio}</p>}
        </div>

        {/* Location pill */}
        {toggles.profile && (preview || !hiddenModules.includes('profile')) && toggles.profile_location && showFeature('profile_location') && <button data-feature="profile_location"
          type="button"
          onClick={onLocationTap}
          className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10"
          aria-label="Location"
        >
          <span className="text-sm leading-none">&#x1F4CD;</span>
          <span className="text-white/90 text-xs font-medium">{siteConfig.profile.location}</span>
        </button>}

      </FeatureLayout>,
    announcement: isModuleAvailable('announcement') && (preview || visibilityLoaded) && toggles.announcement && (preview || !hiddenModules.includes('announcement')) && <LiveAnnouncement managed={announcement} />,
    socials: toggles.socials && (preview || !hiddenModules.includes('socials')) && <SocialLinks />,
    spotify: ((preview || visibilityLoaded) && toggles.spotify && (preview || !hiddenModules.includes('spotify')) && (
          <SpotifyWidget
            showWidget={(toggles.spotify_widget ?? true) && showFeature('spotify_widget')}
            showPosition={(toggles.spotify_position ?? true) && showFeature('spotify_position')}
            showEmbed={(toggles.spotify_embed ?? true) && showFeature('spotify_embed')}
            showPlaylistLink={(toggles.spotify_playlist ?? true) && showFeature('spotify_playlist')}
            showHistory={(toggles.spotify_history ?? true) && showFeature('spotify_history')}
          />
        )),
    twitch: (twitchEnabled && (showTwitchProfile || showTwitchStats || (showTwitchLive && !takeover) || showTwitchSchedule) && <TwitchWidget state={twitch} showProfile={showTwitchProfile} showStats={showTwitchStats} showLive={showTwitchLive && !takeover} showSchedule={showTwitchSchedule} scheduleTimeZone={mediaPreferences.scheduleTimeZone ?? undefined} />),
    discord: ((preview || visibilityLoaded) && toggles.discord !== false && (preview || !hiddenModules.includes('discord')) && ((toggles.discord_profile ?? true) || toggles.discord_music || toggles.discord_video || toggles.discord_games || toggles.discord_status || toggles.discord_other) && (
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
            showMobile={(toggles.discord_mobile ?? true) && showFeature('discord_mobile')}
            showWeb={(toggles.discord_web ?? true) && showFeature('discord_web')}
            showDesktop={(toggles.discord_desktop ?? true) && showFeature('discord_desktop')}
          />
        )),
    youtube: ((preview || visibilityLoaded) && toggles.youtube !== false && (preview || (mediaPreferences.showYoutube && !hiddenModules.includes('youtube'))) && <YouTubeWidget
          showStats={(toggles.youtube_stats ?? true) && (preview || mediaPreferences.showYoutubeStats) && showFeature('youtube_stats')}
          showLatest={(toggles.youtube_latest ?? true) && (preview || mediaPreferences.showLatestUpload) && showFeature('youtube_latest')}
          showLive={(toggles.youtube_live ?? true) && (preview || mediaPreferences.showYoutubeLive) && showFeature('youtube_live')}
          includeShorts={!!toggles.youtube_shorts && showFeature('youtube_shorts') && (preview || mediaPreferences.youtubeFormat !== 'videos')}
          includeVideos={!!toggles.youtube_videos && showFeature('youtube_videos') && (preview || mediaPreferences.youtubeFormat !== 'shorts')}
          showEmbed={isControlAvailable('youtube_embed_default') && (preview || mediaPreferences.youtubeEmbed === 'default' ? (toggles.youtube_embed_default ?? false) : mediaPreferences.youtubeEmbed === 'on')}
        />),
    roblox: ((preview || visibilityLoaded) && toggles.roblox !== false && (preview || !hiddenModules.includes('roblox')) && <CommunityWidget service="roblox" visible={communityVisible} />),
    steam: ((preview || visibilityLoaded) && toggles.steam !== false && (preview || !hiddenModules.includes('steam')) && <CommunityWidget service="steam" visible={communityVisible} />),
    buymeacoffee: ((preview || visibilityLoaded) && toggles.buymeacoffee !== false && (preview || !hiddenModules.includes('buymeacoffee')) && <BuyMeACoffeeWidget visible={communityVisible} />),
    github: (showGithub && <GithubWidget {...githubVisibility} />),
  }

  return (
    <LayoutOrderProvider layout={layout}><div style={takeover ? undefined : { background: `linear-gradient(180deg,${siteConfig.appearance.card.from},${siteConfig.appearance.card.to})` }} className={`relative profile-card w-full rounded-3xl shadow-2xl overflow-hidden border border-white/10 ${takeover ? 'bg-[linear-gradient(180deg,#170b29_0%,#401265_55%,#8B0000_100%)]' : ''}`}>
      {takeover && twitch.presence && <StreamTakeover presence={twitch.presence} />}
      <div className="flex flex-col items-center px-5 sm:px-7 pt-8 sm:pt-9 pb-6 sm:pb-7 gap-4">

        {layout.moduleOrder.map((id) => Object.hasOwn(modules, id) && modules[id] ? <div key={id} className="contents">{modules[id]}</div> : null)}

      </div>
    </div></LayoutOrderProvider>
  )
}
