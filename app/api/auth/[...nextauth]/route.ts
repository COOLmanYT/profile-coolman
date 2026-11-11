import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { privacyRuntimeBlocked } from '@/lib/privacy-policy.mjs'
import { privacyUnavailable } from '@/lib/privacy-http.mjs'

const handler = NextAuth(authOptions)

function authRoute(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  if (privacyRuntimeBlocked()) return privacyUnavailable()
  return handler(request, context)
}

export { authRoute as GET, authRoute as POST }
