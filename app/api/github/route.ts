import { NextRequest, NextResponse } from 'next/server'
import { createGithubActivityLoader } from '@/lib/github-activity.mjs'
import { monitoredFetch } from '@/lib/provider-monitor.mjs'
import { limitPublicRequest } from '@/lib/rate-limit.mjs'

export const dynamic = 'force-dynamic'
const activity = createGithubActivityLoader({ fetcher: (url, init) => monitoredFetch('github', url, init) })

export async function GET(req: NextRequest) {
  const rate = limitPublicRequest(req, 'github')
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(rate.retryAfterSeconds) } })
  try {
    const profile = await activity.get()
    return NextResponse.json(profile, { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': profile.providerStatus === 'healthy' ? 'max-age=3600' : 'max-age=60' } })
  } catch (error) {
    const retry = error instanceof Error && 'retryAfterSeconds' in error ? Number(error.retryAfterSeconds) : 60
    return NextResponse.json({ providerStatus: 'unavailable', error: 'GitHub activity unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retry) } })
  }
}
