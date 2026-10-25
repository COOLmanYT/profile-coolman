export const COMMUNITY_CONTROLS = [
  { title: 'Roblox', parentKey: 'roblox', description: 'Choose each part of the Roblox card.', features: [
    ['roblox_avatar', 'Avatar'], ['roblox_name', 'Display name'], ['roblox_username', 'Username'],
    ['roblox_stats', 'Social counts'], ['roblox_friends', 'Friends'], ['roblox_followers', 'Followers'], ['roblox_following', 'Following'],
  ] },
  { title: 'Steam', parentKey: 'steam', description: 'Choose each part of the Steam card.', features: [
    ['steam_avatar', 'Avatar'], ['steam_name', 'Display name'], ['steam_username', 'Username'],
    ['steam_activity', 'Activity and stats'], ['steam_status', 'Online status'], ['steam_game', 'Current game and store link'],
    ['steam_hours', 'Hours in the past two weeks'], ['steam_library', 'Games in library and library link'],
  ] },
  { title: 'Buy Me a Coffee', parentKey: 'buymeacoffee', description: 'Choose each part of the support card.', features: [
    ['buymeacoffee_cover', 'Cover image'], ['buymeacoffee_avatar', 'Avatar'], ['buymeacoffee_name', 'Display name'],
    ['buymeacoffee_username', 'Creator tagline'], ['buymeacoffee_bio', 'Bio'], ['buymeacoffee_price', 'Support price'],
    ['buymeacoffee_supporters', 'Public supporter total'], ['buymeacoffee_memberships', 'Membership options'],
    ['buymeacoffee_button', 'Support button'],
  ] },
]

export const COMMUNITY_DEFAULTS = Object.fromEntries(COMMUNITY_CONTROLS.flatMap(({ parentKey, features }) => [[parentKey, true], ...features.map(([key]) => [key, key !== 'buymeacoffee_bio'])]))
