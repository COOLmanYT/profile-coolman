export interface DiscordAchievementBadge {
  key: string
  label: string
  details: string
  iconUrl: string
}

// Edit these owner-maintained values to update the profile's achievement badges.
// null means unknown/hidden; 0 means no unlocked badge. Lanyard KV overrides these defaults.
export const DISCORD_BADGE_DEFAULTS = {
  discord_account_created_at: '2025-11-08', // 8 November 2025, in YYYY-MM-DD format.
  discord_game_time_hours: null as number | null,
  discord_games_played: null as number | null,
  discord_streaming_hours: null as number | null,
}

// Badge families: https://support.discord.com/hc/en-us/articles/44369363856663
// Tier names, milestones and Discord-hosted artwork:
// https://github.com/mezotv/discord-badges#account-age-badges
const ACCOUNT_AGE = [
  ['Seed', 'dda73966211a0c16533f8fcd9f1f27c27a628ef562927270e79df9b9c5e6cb12'],
  ['Sprout', '74e1884f930b0d69986f92aeea77d3ff3d3d00c540f386b63e6ebb382d5e927d'],
  ['Bud', '217dab12dcb72d4c95f2863e9dddd5c42003345a001684ea55a736172f32eea1'],
  ['Sapling', '26b89419a4f562ab31a1a72eac04833aa1026af937f1d53c088ec258df3db84b'],
  ['Blossom', '1db184b6d10a61a37dc30efdc74d587560fac5291c8bb329977e93bb5a312602'],
  ['Redwood', '6b0f2ed5be272942eeabea3a0289027d164c7b1ce6a76166d1c928a57db762c5'],
  ['Sequoia', 'c095e3e73591843a22dc979d1fcfe3d6cf6841d1f51387d208d19f8bed01deb7'],
  ['Bristlecone', '867feeff5acd481c80bae557c586718fb5390bbaaa1cbde55fae296a7884e799'],
  ['Stromatolite', 'a6f4c487be2aa012f41f1fba40e664f914ede9251f4b967d890ab5c065a29fb7'],
  ['Primordial', '1d8caace0299b12bcc469c35ce927e838abd9c645a22fe7c556f4394e57fa79b'],
] as const

const STREAMING = [
  ['Newcomer', 'c56b451e3bf04181182c2529e9bd3659e569ea80f582858090007f0752401b38'],
  ['Fledgling', '2e25ba794f6f371ea0f52eb2d3c8fb2b04094a56f388515e13a9bd6d7949a018'],
  ['Breakout', '4e847b4dca20fbf1c56d3a47cac3c9204f02113c9d5a270ebebdf12909c75848'],
  ['Standout', '27d0e6939f13dcf113243fc9eac642b15e9764ad891e06c5ed78d45a17678582'],
  ['Trendsetter', 'af681483be2035f14b0f2bfe2e25a8944c97149172938888ca1008edbe037aad'],
  ['Headliner', 'e69a0c86a476c9782ea1d3e7b5ba308eec3d9d6a3eae6ab8af3180f67d16b468'],
  ['Star', '06b6206db966635cf626651bdb94eacce5a23ab05dc7f600f7d31aa482b2058c'],
  ['Sensation', '1a3b9120ecd64c342083c37980b225d29ebf4544da6ab546c9268f87904c9dfe'],
  ['Visionary', '85f714b90ed3ceb1e00e1f2069bf3ebd564962fa940c92540061537a045e54ab'],
  ['Phenomenon', '61331d04b7a9542b38bfa59583360c0b9b93c6496a04f99c0ab37fa1d83ec58a'],
] as const

const GAME_TIME = [
  ['Casual', 'b75fcc4dd1c65dfd4169a203e21023453fd6fe853c9b5c1fd839781fda98e80d'],
  ['Recreational', 'f0f32cb2a0003475e443b76a7a2baf454356953ecb84195c7a08c3ce2fd95b70'],
  ['Dedicated', 'e0c82f41bcad94a2a52713800fbef7687d0d2c6a6066b09d5e5876156d086e1a'],
  ['Committed', '16f2aeb7465c99efce4d67d9333e3ddcf7435d6e60d2f5f93dc0c07bc7c5a69b'],
  ['Serious', 'ba26e83fa68189b41837184e38706f41c288dd29ffba266035d1a5ad9adbae22'],
  ['Devoted', '851b194288f1913ece6c8d99976519e48210580d6f42d994f21e37801611ad54'],
  ['Seasoned', '8b10f5c0c30abbd521be5afc2e0dd4ec6da18bfbc689f06d93a51d06577cd84a'],
  ['Ironclad', 'd705628490898f2cc22d669cf8b415bc03fed1ddaf98a2a8cbd97442a509293c'],
  ['Unshakeable', '2bddcbc9f9959dab805eb7196c8112ce9dc68b09766c8193ab499b1870e44ac7'],
  ['Eternal', '457ce4e657f0ced23197891cc3d75b7de29cafa065cdb8cbb81060ac0e63b07f'],
] as const

const GAME_VARIETY = [
  ['Sampler', 'ed18d5976c01a4ea19f5a13af08f0547582405cbe48b098b0822e352b8e0a822'],
  ['Dabbler', 'e450d5279537db06ee47a104af520b884adaa7ffc3ef2627157526bf1c58e840'],
  ['Enthusiast', '158a9d91b8ca9e96d4afeee38cd640fc51483a8196edb9af0c26e44727acafae'],
  ['Ranger', '9e491942070007f64011ae4fc478926b96433698c07621fc43bafdd5efe83912'],
  ['Explorer', 'e25fc55814262150e154ddb1a2b55fc5ed8ed5ba2ff1a22a33d4a41e651e370a'],
  ['Adventurer', '542d5277e0001ea738d5eb57b247dcab9ce6e0c29493d5892203f6258fde55b9'],
  ['Voyager', '082e693cb9ce98b81af618978d449409efc6522b061bc0eac6e88a949fd888c6'],
  ['Maverick', '6fc242e9e8259c471a5e4599cd09af5476e622a572ff235883173913bf506103'],
  ['Polymath', 'be9a4d119b8e0d7fc1df7e5a12081332637cb9c978a90377cb9c930500b2fbe6'],
  ['Universalist', 'fcc34d343451505c642f3397cec2669a2de3a4a410fb968f794b3a1a0dcd1728'],
] as const

const HOUR_MILESTONES = [1, 5, 20, 75, 150, 300, 500, 1000, 2000, 5000]
const GAME_MILESTONES = [2, 5, 10, 15, 20, 30, 40, 60, 80, 100]
type Tier = readonly [string, string]

function makeBadge(key: string, family: string, tier: Tier, details: string): DiscordAchievementBadge {
  return { key, label: `${family}: ${tier[0]}`, details, iconUrl: `https://cdn.discordapp.com/assets/content/${tier[1]}.svg` }
}

function readProgress(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value)) return undefined
  const progress = Number(value)
  return Number.isFinite(progress) && progress >= 0 ? progress : undefined
}

function getAccountCreatedAt(id: string | undefined, configuredDate: unknown) {
  if (typeof configuredDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(configuredDate)) {
    const date = new Date(`${configuredDate}T00:00:00.000Z`)
    // Reject calendar rollovers such as 2025-02-30 instead of silently changing the date.
    if (Number.isFinite(date.getTime()) && date.getTime() >= 1420070400000 && date.toISOString().slice(0, 10) === configuredDate) return date
  }
  if (!id || !/^\d{17,20}$/.test(id)) return undefined
  const snowflake = BigInt(id)
  if (snowflake > BigInt('18446744073709551615')) return undefined
  return new Date(Number(snowflake >> BigInt(22)) + 1420070400000)
}

function accountAgeBadge(id: string | undefined, now: number, configuredDate: unknown) {
  const created = getAccountCreatedAt(id, configuredDate)
  if (!created) return undefined
  const today = new Date(now)
  if (!Number.isFinite(today.getTime()) || created.getTime() > now) return undefined
  let years = today.getUTCFullYear() - created.getUTCFullYear()
  const anniversary = new Date(created)
  anniversary.setUTCFullYear(today.getUTCFullYear())
  if (today < anniversary) years -= 1
  if (years < 1) return undefined
  return makeBadge('account-age', 'Account Age', ACCOUNT_AGE[Math.min(years, 10) - 1], `${years} year${years === 1 ? '' : 's'} on Discord`)
}

/** Lanyard does not provide historical activity totals. Only use explicitly supplied progress. */
export function getDiscordAchievementBadges(id?: string, kv: Record<string, unknown> = {}, now = Date.now()): DiscordAchievementBadge[] {
  const badges: DiscordAchievementBadge[] = []
  const age = accountAgeBadge(id, now, kv.discord_account_created_at)
  // Match Discord's profile badge visibility without changing presence/activity visibility.
  if (age && kv.discord_account_age_badge !== 'false' && kv.discord_account_age_badge !== false) badges.push(age)
  const families = [
    { key: 'game-time', name: 'Game Time', value: kv.discord_game_time_hours, tiers: GAME_TIME, milestones: HOUR_MILESTONES, unit: 'hours played' },
    { key: 'game-variety', name: 'Game Variety', value: kv.discord_games_played, tiers: GAME_VARIETY, milestones: GAME_MILESTONES, unit: 'different games played' },
    { key: 'streaming', name: 'Streaming', value: kv.discord_streaming_hours, tiers: STREAMING, milestones: HOUR_MILESTONES, unit: 'hours streamed' },
  ]
  for (const family of families) {
    const progress = readProgress(family.value)
    if (progress === undefined || (family.key === 'game-variety' && !Number.isInteger(progress))) continue
    let level = -1
    family.milestones.forEach((milestone, index) => { if (progress >= milestone) level = index })
    const unit = progress === 1 ? family.unit.replace('hours', 'hour') : family.unit
    if (level >= 0) badges.push(makeBadge(family.key, family.name, family.tiers[level], `${progress.toLocaleString('en')} ${unit}`))
  }
  return badges
}
