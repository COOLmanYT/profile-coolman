import { NextResponse } from 'next/server'
import { privacyUnavailable } from '@/lib/privacy-http.mjs'
import { privacyRuntimeBlocked } from '@/lib/privacy-policy.mjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (privacyRuntimeBlocked()) return privacyUnavailable()
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
