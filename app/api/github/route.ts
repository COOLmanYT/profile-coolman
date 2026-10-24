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
    return NextResponse.json(await activity.get(), { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=900' } })
  } catch (error) {
    const retry = error instanceof Error && 'retryAfterSeconds' in error ? Number(error.retryAfterSeconds) : 60
    return NextResponse.json({ providerStatus: 'unavailable', error: 'GitHub activity unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retry) } })
  }
}
