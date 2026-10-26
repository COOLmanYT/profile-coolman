import type { Session } from 'next-auth'
import { siteConfig } from './site-config.mjs'
import { readDashboardSetting } from './dashboard-settings'

export const OAUTH_PROVIDERS = ['discord', 'github', 'google'] as const
export type OAuthProvider = typeof OAUTH_PROVIDERS[number]
export type DashboardMember = { provider: OAuthProvider; subject: string }
export function providerEnabled(provider: string): provider is OAuthProvider {
  return OAUTH_PROVIDERS.includes(provider as OAuthProvider) && siteConfig.dashboard.auth.providers[provider as OAuthProvider]
}
export function bootstrapOwner(provider: string, subject: string) {
  if (!providerEnabled(provider) || !subject) return false
  if (provider === 'discord' && process.env.DISCORD_USER_ID && subject === process.env.DISCORD_USER_ID) return true
  return (process.env.DASHBOARD_OWNER_ACCOUNTS ?? '').split(',').map(value => value.trim()).includes(`${provider}:${subject}`)
}
export function validMembers(value: unknown): value is DashboardMember[] {
  return Array.isArray(value) && value.length <= 50 && value.every(item => item && OAUTH_PROVIDERS.includes(item.provider) && typeof item.subject === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(item.subject)) && new Set(value.map(item => `${item.provider}:${item.subject}`)).size === value.length
}
export async function getDashboardMembers(): Promise<DashboardMember[]> {
  const value = await readDashboardSetting('dashboard-access')
  return validMembers(value) ? value : []
}
export async function dashboardIdentity(provider: string, subject: string) {
  if (!providerEnabled(provider) || !subject) return null
  if (bootstrapOwner(provider, subject)) return { provider, subject, owner: true }
  if (!siteConfig.dashboard.features.accessManagement) return null
  return (await getDashboardMembers()).some(member => member.provider === provider && member.subject === subject) ? { provider, subject, owner: false } : null
}
export async function dashboardAccess(session: Session | null) {
  const user = session?.user as { id?: string; provider?: string } | undefined
  if (!user?.id) return null
  // Existing Discord sessions predate the provider claim and remain valid.
  return dashboardIdentity(user.provider ?? 'discord', user.id)
}
