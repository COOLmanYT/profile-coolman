import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assertPrivacyDestination } from './privacy-policy.mjs'

// A single memoized service-role client shared across server modules. Each
// previous call site constructed its own client (and connection pool) per
// request; reusing one avoids that overhead and centralizes the env checks.
let client: SupabaseClient | null = null
let attempted = false

export function getSupabase(): SupabaseClient | null {
  if (attempted) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (url) assertPrivacyDestination(url)
  attempted = true
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null

  client = createClient(url, key)
  return client
}
