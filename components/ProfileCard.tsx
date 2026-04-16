import AvatarImage from './AvatarImage'
import SpotifyWidget from './SpotifyWidget'
import DiscordWidget from './DiscordWidget'
import SocialLinks from './SocialLinks'

interface ProfileCardProps {
  toggles: Record<string, boolean>
}

export default function ProfileCard({ toggles }: ProfileCardProps) {
  return (
    <div className="w-[390px] rounded-3xl shadow-2xl overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#ff0000_0%,#8B0000_100%)]">
      <div className="flex flex-col items-center px-7 pt-9 pb-7 gap-4">
        {/* Avatar */}
        <div className="relative w-[88px] h-[88px] rounded-full overflow-hidden ring-4 ring-white/30 shadow-xl flex-shrink-0">
          <AvatarImage />
        </div>

        {/* Username */}
        <div className="text-center -mt-1">
          <h1 className="text-[28px] font-bold text-white tracking-tight leading-tight title-soft-glow">COOLman</h1>
          <p className="text-white/70 text-sm mt-1 leading-snug">just a cool dude making content</p>
        </div>

        {/* Location pill */}
        <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10">
          <span className="text-sm leading-none">&#x1F4CD;</span>
          <span className="text-white/90 text-xs font-medium">lost in my thoughts</span>
        </div>

        {/* Spotify Widget */}
        {toggles.spotify && (
          <SpotifyWidget showEmbed={toggles.spotify_embed ?? true} />
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
