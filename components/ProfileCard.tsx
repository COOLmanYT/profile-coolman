import Image from 'next/image'
import SpotifyWidget from './SpotifyWidget'
import DiscordWidget from './DiscordWidget'
import SocialLinks from './SocialLinks'

interface ProfileCardProps {
  toggles: Record<string, boolean>
}

export default function ProfileCard({ toggles }: ProfileCardProps) {
  return (
    <div
      className="w-[400px] rounded-2xl shadow-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #ff0000 0%, #8B0000 100%)' }}
    >
      <div className="flex flex-col items-center px-8 pt-8 pb-6 gap-4">
        {/* Avatar */}
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white/20 shadow-lg">
          <Image
            src="/avatar.png"
            alt="COOLman avatar"
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        {/* Username */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-wide">COOLman</h1>
          <p className="text-white/80 text-sm mt-1">just a cool dude making content</p>
        </div>

        {/* Location pill */}
        <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
          <span className="text-sm">��</span>
          <span className="text-white text-sm font-medium">lost in my thoughts</span>
        </div>

        {/* Spotify Widget */}
        {toggles.spotify && (
          <SpotifyWidget />
        )}

        {/* Discord Widget */}
        {(toggles.discord_music || toggles.discord_video || toggles.discord_games || toggles.discord_status || toggles.discord_other) && (
          <DiscordWidget
            showMusic={toggles.discord_music}
            showVideo={toggles.discord_video}
            showGames={toggles.discord_games}
            showStatus={toggles.discord_status}
            showOther={toggles.discord_other}
          />
        )}

        {/* Social Links */}
        <SocialLinks />
      </div>
    </div>
  )
}
