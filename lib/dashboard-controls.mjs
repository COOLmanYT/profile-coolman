import { COMMUNITY_CONTROLS } from './community-controls.mjs'

export const DASHBOARD_LABELS = {
  ...Object.fromEntries(COMMUNITY_CONTROLS.flatMap(({ parentKey, features }) => [[parentKey, 'Entire module'], ...features])),
  spotify: 'Entire module',
  spotify_widget: 'Now-playing widget',
  spotify_position: 'Player position and duration',
  spotify_embed: 'Embed Player',
  spotify_playlist: 'Playlist Link',
  spotify_history: 'Listening History',
  twitch: 'Entire module',
  twitch_profile: 'Channel profile and live status',
  twitch_stats: 'Follower and subscriber totals',
  twitch_live: 'Live stream widget',
  twitch_schedule: 'Next scheduled stream',
  youtube: 'Entire module',
  youtube_stats: 'Subscribers, total views, video count and last upload',
  youtube_latest: 'Latest upload (all formats)',
  youtube_live: 'Live status and stream link',
  youtube_shorts: 'Include Shorts',
  youtube_videos: 'Include videos and stream uploads',
  youtube_embed_default: 'Playable embed on by default for visitors',
  discord: 'Entire module',
  discord_profile: 'Profile and presence status',
  discord_banner: 'Profile banner',
  discord_badges: 'Profile badges',
  discord_decoration: 'Avatar decoration and nameplate',
  discord_devices: 'Device presence',
  discord_music: 'Music',
  discord_video: 'Video',
  discord_games: 'Games',
  discord_status: 'Custom Status',
  discord_other: 'Other Activity',
  discord_mobile: 'Mobile',
  discord_web: 'Web',
  discord_desktop: 'Desktop',
}

export const DASHBOARD_GROUPS = [
  { title: 'Spotify', description: 'Control the entire Spotify module or its individual sections.', parentKey: 'spotify', keys: ['spotify', 'spotify_widget', 'spotify_position', 'spotify_embed', 'spotify_playlist', 'spotify_history'] },
  { title: 'Twitch', description: 'Control the entire Twitch module or its channel, stats and stream sections.', parentKey: 'twitch', keys: ['twitch', 'twitch_profile', 'twitch_stats', 'twitch_live', 'twitch_schedule'] },
  { title: 'YouTube', description: 'Choose channel sections and allowed upload formats. The embed default is off; visitors can override it in Options.', parentKey: 'youtube', keys: ['youtube', 'youtube_stats', 'youtube_latest', 'youtube_live', 'youtube_shorts', 'youtube_videos', 'youtube_embed_default'] },
  { title: 'Discord profile', description: 'Control the entire Discord module or its profile details.', parentKey: 'discord', keys: ['discord', 'discord_profile', 'discord_banner', 'discord_badges', 'discord_decoration', 'discord_devices'] },
  { title: 'Discord Activity', description: 'Choose which Discord activity types appear.', parentKey: 'discord', keys: ['discord_music', 'discord_video', 'discord_games', 'discord_status', 'discord_other'] },
  { title: 'Discord Devices', description: 'Choose which active Discord devices appear.', parentKey: 'discord', keys: ['discord_mobile', 'discord_web', 'discord_desktop'] },
  ...COMMUNITY_CONTROLS.map(({ title, description, parentKey, features }) => ({ title, description, parentKey, keys: [parentKey, ...features.map(([key]) => key)] })),
]

const SECTION_PARENTS = Object.fromEntries([
  ...['roblox_friends', 'roblox_followers', 'roblox_following'].map((key) => [key, 'roblox_stats']),
  ...['steam_status', 'steam_game', 'steam_hours', 'steam_library'].map((key) => [key, 'steam_activity']),
])

export function isControlDisabled(key, parentKey, toggles) {
  return (key !== parentKey && toggles[parentKey] === false) || (SECTION_PARENTS[key] !== undefined && toggles[SECTION_PARENTS[key]] === false)
}
