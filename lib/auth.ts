import DiscordProvider from 'next-auth/providers/discord'
import type { NextAuthOptions } from 'next-auth'

const ALLOWED_DISCORD_ID = process.env.DISCORD_USER_ID

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (!ALLOWED_DISCORD_ID) return false
      if (account?.provider === 'discord') {
        const discordProfile = profile as { id?: string }
        return discordProfile?.id === ALLOWED_DISCORD_ID
      }
      return false
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
}
