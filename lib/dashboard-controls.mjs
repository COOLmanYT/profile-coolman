import { COMMUNITY_CONTROLS } from './community-controls.mjs'

export const DASHBOARD_LABELS = {
  github: 'Entire module',
  github_status: 'GitHub public status',
  github_profile: 'GitHub profile header',
  github_stats: 'Star and public repository totals',
  github_commits: 'Commits made in past year',
  github_graph: 'Contribution graph',
  github_projects: 'Recently updated projects',
  github_commit_titles: 'Latest commit titles',
  github_language: 'Project languages',
  github_licence: 'Project licences',
  announcement: 'Live announcement',
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
  twitch_takeover: 'Feature the stream at the top while live',
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
  { title: 'GitHub', description: 'Control the entire GitHub module or its individual sections.', parentKey: 'github', keys: ['github', 'github_status', 'github_profile', 'github_stats', 'github_commits', 'github_graph', 'github_projects', 'github_commit_titles', 'github_language', 'github_licence'] },
  { title: 'Announcement', description: 'Message the Lanyard bot: .set announcement Your message. Clear it with .del announcement. Optional link: .set announcement_url https://example.com', parentKey: 'announcement', keys: ['announcement'] },
  { title: 'Spotify', description: 'Control the entire Spotify module or its individual sections.', parentKey: 'spotify', keys: ['spotify', 'spotify_widget', 'spotify_position', 'spotify_embed', 'spotify_playlist', 'spotify_history'] },
  { title: 'Twitch', description: 'Control the channel, stats and stream sections. Stream takeover also requires the live stream widget to be enabled.', parentKey: 'twitch', keys: ['twitch', 'twitch_profile', 'twitch_stats', 'twitch_live', 'twitch_takeover', 'twitch_schedule'] },
  { title: 'YouTube', description: 'Choose channel sections and allowed upload formats. The embed default is off; visitors can override it in Options.', parentKey: 'youtube', keys: ['youtube', 'youtube_stats', 'youtube_latest', 'youtube_live', 'youtube_shorts', 'youtube_videos', 'youtube_embed_default'] },
  { title: 'Discord profile', description: 'Control the entire Discord module or its profile details.', parentKey: 'discord', keys: ['discord', 'discord_profile', 'discord_banner', 'discord_badges', 'discord_decoration', 'discord_devices'] },
  { title: 'Discord Activity', description: 'Choose which Discord activity types appear.', parentKey: 'discord', keys: ['discord_music', 'discord_video', 'discord_games', 'discord_status', 'discord_other'] },
  { title: 'Discord Devices', description: 'Choose which active Discord devices appear.', parentKey: 'discord', keys: ['discord_mobile', 'discord_web', 'discord_desktop'] },
  ...COMMUNITY_CONTROLS.map(({ title, description, parentKey, features }) => ({ title, description, parentKey, keys: [parentKey, ...features.map(([key]) => key)] })),
]

const SECTION_PARENTS = Object.fromEntries([
  ['twitch_takeover', 'twitch_live'],
  ...['github_commit_titles', 'github_language', 'github_licence'].map((key) => [key, 'github_projects']),
  ...['roblox_friends', 'roblox_followers', 'roblox_following'].map((key) => [key, 'roblox_stats']),
  ...['steam_status', 'steam_game', 'steam_hours', 'steam_library'].map((key) => [key, 'steam_activity']),
])

export function isControlDisabled(key, parentKey, toggles) {
  return (key !== parentKey && toggles[parentKey] === false) || (SECTION_PARENTS[key] !== undefined && toggles[SECTION_PARENTS[key]] === false)
}
