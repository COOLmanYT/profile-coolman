import DiscordProvider from 'next-auth/providers/discord'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'
import { dashboardIdentity, providerEnabled } from './dashboard-access'

export const authOptions: NextAuthOptions = {
  providers: [
    ...(providerEnabled('discord') ? [DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    })] : []),
    ...(providerEnabled('github') && process.env.AUTH_GITHUB_CLIENT_ID && process.env.AUTH_GITHUB_CLIENT_SECRET ? [GitHubProvider({ clientId: process.env.AUTH_GITHUB_CLIENT_ID, clientSecret: process.env.AUTH_GITHUB_CLIENT_SECRET })] : []),
    ...(providerEnabled('google') && process.env.AUTH_GOOGLE_CLIENT_ID && process.env.AUTH_GOOGLE_CLIENT_SECRET ? [GoogleProvider({ clientId: process.env.AUTH_GOOGLE_CLIENT_ID, clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET })] : []),
  ],
  callbacks: {
    async signIn({ account }) {
      return !!account && !!(await dashboardIdentity(account.provider, account.providerAccountId))
    },
    async jwt({ token, account }) {
      if (account) { token.dashboardProvider = account.provider; token.dashboardSubject = account.providerAccountId }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const user = session.user as { id?: string; provider?: string }
        user.id = typeof token.dashboardSubject === 'string' ? token.dashboardSubject : token.sub
        user.provider = typeof token.dashboardProvider === 'string' ? token.dashboardProvider : 'discord'
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
}
