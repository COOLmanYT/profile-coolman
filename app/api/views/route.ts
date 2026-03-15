import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

export async function GET() {
  try {
    const supabase = getSupabase()
    if (!supabase) return NextResponse.json({ count: 0 })
    const { data } = await supabase
      .from('views')
      .select('count')
      .eq('id', 'profile')
      .single()
    return NextResponse.json({ count: data?.count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}

export async function POST() {
  try {
    const supabase = getSupabase()
    if (!supabase) return NextResponse.json({ count: 0 })

    const { data: existing } = await supabase
      .from('views')
      .select('count')
      .eq('id', 'profile')
      .single()

    const newCount = (existing?.count ?? 0) + 1

    await supabase
      .from('views')
      .upsert({ id: 'profile', count: newCount })

    return NextResponse.json({ count: newCount })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
